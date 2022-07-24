import { beforeChannelAttach } from './attach';
import { httpRequest, toTokenDetails, parseJwt } from './utils';
import { SequentialAuthTokenRequestExecuter } from './token-request';
import { AblyChannel } from '../ably-channel';
import { AblyConnector } from '../../connector/ably-connector';
import { AblyPresenceChannel } from '../ably-presence-channel';
import { AuthOptions, ChannelStateChange } from '../../../typings/ably';

export class AblyAuth {

    authRequestExecuter: SequentialAuthTokenRequestExecuter;
    authEndpoint = '/broadcasting/auth';
    authHost = typeof window != 'undefined' && window?.location?.hostname;
    authPort = typeof window != 'undefined' && window?.location?.port;
    authProtocol = typeof window != 'undefined' && window?.location?.protocol.replace(':', '');

    authOptions : AuthOptions = {
        queryTime: true,
        useTokenAuth: true,
        authCallback: async (_, callback) => {
            try {
                const { token } = await this.authRequestExecuter.request(null);
                const tokenDetails = toTokenDetails(token);
                callback(null, tokenDetails);
            } catch (error) {
                callback(error, null);
            }
        }
    }

    async requestToken(channelName: string, existingToken: string) {
        var postData = JSON.stringify({ channel_name: channelName, token: existingToken });
        var postOptions = {
            host: this.authHost,
            port: this.authPort,
            path: this.authEndpoint,
            method: 'POST',
            scheme: this.authProtocol,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Content-Length': postData.length },
            body: postData,
        };

        return new Promise((resolve, reject) => {
            httpRequest(postOptions, function (err: any, res: any) {
                if (err) {
                    reject(err);
                } else {
                    if (typeof res === 'string') {
                        resolve(JSON.parse(res));
                    } else {
                        resolve(res);
                    }
                }
            })
        });
    }

    constructor(options) {
        const { token, requestTokenFn, authEndpoint, authHost, authPort, authProtocol } = options;
        if (authEndpoint) {
            this.authEndpoint = authEndpoint;
        };
        if (authHost) {
            this.authHost = authHost;
        };
        if (authPort) {
            this.authPort = authPort;
        };
        if (authProtocol) {
            this.authProtocol = authProtocol;
        };
        this.authRequestExecuter = new SequentialAuthTokenRequestExecuter(token, requestTokenFn ?? this.requestToken);
    }

    enableAuthorizeBeforeChannelAttach(ablyConnector: AblyConnector) {
        const ablyClient: any = ablyConnector.ably;
        ablyClient.auth.getTimestamp(this.authOptions.queryTime, () => { }); // generates serverTimeOffset in the background
        beforeChannelAttach(ablyClient, (realtimeChannel, errorCallback) => {
            const channelName = realtimeChannel.name;
            if (channelName.startsWith("public:")) {
                errorCallback(null);
                return;
            }

            // Use cached token if has channel capability and is not expired
            const tokenDetails = ablyClient.auth.tokenDetails;
            if (tokenDetails) {
                const capability = parseJwt(tokenDetails.token).payload['x-ably-capability'];
                const tokenHasChannelCapability = capability.includes(`${channelName}"`);
                if (tokenHasChannelCapability && tokenDetails.expires > ablyClient.auth.getTimestampUsingOffset()) { // checks with server time using offset, otherwise local time
                    errorCallback(null);
                    return;
                }
            }

            // explicitly request token for given channel name
            this.authRequestExecuter.request(channelName).then(({ token: jwtToken, info }) => { // get upgraded token with channel access
                const echoChannel = ablyConnector.channels[channelName];
                this.setPresenceInfo(echoChannel, info);
                ablyClient.auth.authorize(null, { ...this.authOptions, token: toTokenDetails(jwtToken) }, (err, _tokenDetails) => {
                    if (err) {
                        errorCallback(err);
                    } else {
                        errorCallback(null);
                    }
                });
            }).catch(err => errorCallback(err));
        });
    }

    onChannelFailed(echoAblyChannel: AblyChannel) {
        return (stateChange: ChannelStateChange) => {
            if (stateChange.reason?.code == 40160) { // channel capability rejected https://help.ably.io/error/40160
                this.handleChannelAuthError(echoAblyChannel);
            }
        }
    }

    handleChannelAuthError = (echoAblyChannel: AblyChannel) => {
        const channelName = echoAblyChannel.name;
        this.authRequestExecuter.request(channelName).then(({ token: jwtToken, info }) => { // get upgraded token with channel access
            this.setPresenceInfo(echoAblyChannel, info);
            echoAblyChannel.ably.auth.authorize(null, { ...this.authOptions, token: toTokenDetails(jwtToken) as any }, (err, _tokenDetails) => {
                if (err) {
                    echoAblyChannel._alertErrorListeners(err);
                } else {
                    echoAblyChannel.channel.attach(echoAblyChannel._alertErrorListeners);
                }
            });
        }).catch(err => echoAblyChannel._alertErrorListeners(err));
    }

    setPresenceInfo = (echoAblyChannel: AblyChannel, info: any) => {
        if (echoAblyChannel instanceof AblyPresenceChannel) {
            echoAblyChannel.presenceData = info;
        }
    }
}

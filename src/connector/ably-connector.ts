import { Connector } from './connector';
import { AblyChannel } from '../channel/ably-channel';
import * as AblyImport from 'ably';
import { PresenceChannel } from '../channel';
import { AblyPresenceChannel } from '../channel/ably-presence-channel';

/**
 * This class creates a connector to Ably.
 */
export class AblyConnector extends Connector {
    /**
     * The Ably instance.
     */
    ably: AblyImport.Types.RealtimeCallbacks;

    /**
     * All of the subscribed channel names.
     */
    channels: Record<string, AblyChannel> = {};

    /**
     * Create a fresh Ably connection.
     */
    connect(): void {
        if (typeof this.options.client !== 'undefined') {
            this.ably = this.options.client;
        } else {
            this.ably = new Ably.Realtime(this.options);
        }
    }

    _channel(name: string): AblyChannel {
        if (!this.channels[name]) {
            this.channels[name] = new AblyChannel(this.ably, name, this.options);
        }

        return this.channels[name];
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(name: string, event: string, callback: Function): AblyChannel {
        return this._channel(name).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     */
    channel(name: string): AblyChannel {
        return this._channel(`public:${name}`);
    }

    /**
     * Get a private channel instance by name.
     */
    privateChannel(name: string): AblyChannel {
        return this._channel(`private:${name}`);
    }

    /**
    * Get a presence channel instance by name.
    */
    presenceChannel(name: string): PresenceChannel {
        return this._channel(`presence:${name}`) as AblyPresenceChannel;
    }

    /**
     * Get a private encrypted channel instance by name.
     */
    encryptedPrivateChannel(name: string): AblyChannel {
        // if (!this.channels['private-encrypted-' + name]) {
        //     this.channels['private-encrypted-' + name] = new AblyEncryptedPrivateChannel(
        //         this.ably,
        //         'private-encrypted-' + name,
        //         this.options
        //     );
        // }
        //
        // return this.channels['private-encrypted-' + name];
        return this.channel(name);
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(name: string): void {
        let channels = [`public:${name}`, `private:${name}`, `presence:${name}`];

        channels.forEach((name: string, index: number) => {
            this.leaveChannel(name);
        });
    }

    /**
     * Leave the given channel.
     */
    leaveChannel(name: string): void {
        if (this.channels[name]) {
            this.channels[name].unsubscribe();

            delete this.channels[name];
        }
    }

    /**
     * Get the socket ID for the connection.
     */
    socketId(): string {
        return this.ably.connection.id;
    }

    /**
     * Disconnect Ably connection.
     */
    disconnect(): void {
        this.ably.close();
    }
}

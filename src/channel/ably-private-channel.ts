import { AblyChannel } from './ably-channel';
import { onChannelFailed } from './ably';
export class AblyPrivateChannel extends AblyChannel {

    constructor(ably: any, name: string, options: any) {
        super(ably, name, options);
        this.channel.on("failed", onChannelFailed(this));
    }
    /**
     * Trigger client event on the channel.
     */
    whisper(eventName: string, data: any): AblyPrivateChannel {
        this.channel.publish(`client-${eventName}`, data);

        return this;
    }
}
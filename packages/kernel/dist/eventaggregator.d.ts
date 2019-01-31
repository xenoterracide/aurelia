import { Constructable, IDisposable } from './interfaces';
export interface Subscription extends IDisposable {
}
/**
 * Enables loosely coupled publish/subscribe messaging.
 * @param data The optional data published on the channel.
 * @param event The event that triggered the callback. Only available on channel based messaging.
 */
export declare type EventAggregatorCallback<T = unknown> = (data?: T, event?: string) => unknown;
/**
 * Enables loosely coupled publish/subscribe messaging.
 */
export declare class EventAggregator {
    /**
     * Creates an instance of the EventAggregator class.
     */
    constructor();
    /**
     * Publishes a message.
     * @param channel The channel to publish to.
     * @param data The data to publish on the channel.
     */
    publish(channel: string, data?: unknown): void;
    /**
     * Publishes a message.
     * @param instance The instance to publish to.
     */
    publish(instance: InstanceType<Constructable>): void;
    /**
     * Subscribes to a message channel.
     * @param channel The event channel.
     * @param callback The callback to be invoked when the specified message is published.
     */
    subscribe<T>(channel: string, callback: EventAggregatorCallback<T>): IDisposable;
    /**
     * Subscribes to a message type.
     * @param type The event data type.
     * @param callback The callback to be invoked when the specified message is published.
     */
    subscribe<T extends Constructable>(type: T, callback: EventAggregatorCallback<InstanceType<T>>): IDisposable;
    /**
     * Subscribes to a message channel, then disposes the subscription automatically after the first message is received.
     * @param channel The event channel.
     * @param callback The callback to be invoked when the specified message is published.
     */
    subscribeOnce<T>(channel: string, callback: EventAggregatorCallback<T>): IDisposable;
    /**
     * Subscribes to a message type, then disposes the subscription automatically after the first message is received.
     * @param type The event data type.
     * @param callback The callback to be invoked when the specified message is published.
     */
    subscribeOnce<T extends Constructable>(type: T, callback: EventAggregatorCallback<InstanceType<T>>): IDisposable;
}
//# sourceMappingURL=eventaggregator.d.ts.map
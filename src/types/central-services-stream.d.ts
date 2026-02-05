declare module '@mojaloop/central-services-stream' {
  import { EventEmitter } from 'events';

  export namespace Kafka {
    interface ConsumerConfig {
      rdkafkaConf?: Record<string, any>;
      options?: {
        mode?: 'consumer' | 'flow' | 'poll' | 'recursive';
        messageCharset?: string;
        messageAsJSON?: boolean;
        sync?: boolean;
        consumeTimeout?: number;
        batchSize?: number;
        concurrency?: number;
        commitOffsetsOnFirstJoin?: boolean;
        autoCommitEnable?: boolean;
        autoCommitIntervalMs?: number;
        eosCommit?: boolean;
        consumeLoopTimeoutMs?: number;
      };
    }

    interface ProducerConfig {
      rdkafkaConf?: Record<string, any>;
      options?: {
        messageCharset?: string;
        messageAsJSON?: boolean;
        sync?: boolean;
        pollIntervalMs?: number;
        queueBufferingMaxMs?: number;
      };
    }

    interface Message {
      topic: string;
      key?: string | Buffer;
      value: string | Buffer;
      partition?: number;
      offset?: number;
      timestamp?: number;
      headers?: Record<string, string | Buffer>;
    }

    interface MessageProtocol {
      content: any,
      id: string,
      from: string,
      to: string,
      metadata: any,
      type: string,
      pp?: string
    }

    interface MessageHandler {
      (error: Error | null, message: Message): Promise<void> | void;
    }

    interface TopicConfiguration {
      opaqueKey: any
      topicName: string,
      key?: string
      partition?: number
    }

    class Consumer extends EventEmitter {
      constructor(topics: string[], config: ConsumerConfig);
      
      connect(): Promise<void>;
      disconnect(callback?: () => void): void;
      consume(handler: MessageHandler): Promise<any>;
      commitMessageSync(message: Message): void;
      commitMessage(message: Message): Promise<void>;
      isConnected(): boolean;
      
      on(event: 'error', listener: (error: Error) => void): this;
      on(event: 'ready', listener: () => void): this;
      on(event: 'disconnected', listener: () => void): this;
      on(event: 'rebalance', listener: (assignment: any) => void): this;
      on(event: string, listener: (...args: any[]) => void): this;
      
      static createHandler(
        topicName: string, 
        config: ConsumerConfig, 
        handler: MessageHandler
      ): Promise<Consumer>;
      
      static ENUMS: {
        CONSUMER_MODES: {
          consumer: 'consumer';
          flow: 'flow'; 
          poll: 'poll';
          recursive: 'recursive';
        };
      };
    }

    class Producer extends EventEmitter {
      constructor(config: ProducerConfig);
      
      connect(): Promise<void>;
      disconnect(callback?: () => void): void;
      sendMessage(
        message: MessageProtocol, 
        topicConf: TopicConfiguration, 
        customHeaders?: Array<{ [key: string]: string | Buffer }>
      ): Promise<void>;
      isConnected(): boolean;
      
      on(event: 'error', listener: (error: Error) => void): this;
      on(event: 'ready', listener: () => void): this;
      on(event: 'disconnected', listener: () => void): this;
      on(event: string, listener: (...args: any[]) => void): this;
      
      static ENUMS: {
        COMPRESSION_TYPES: {
          none: 'none';
          gzip: 'gzip';
          snappy: 'snappy';
          lz4: 'lz4';
        };
      };
    }

    namespace Protocol {
      interface ProtocolMessage {
        id: string;
        from: string;
        to: string;
        type: string;
        content: any;
        metadata?: Record<string, any>;
      }

      function encode(message: ProtocolMessage): Buffer;
      function decode(buffer: Buffer): ProtocolMessage;
    }
  }

  export namespace Util {
    namespace Consumer {
      function getConsumerModeMap(): Record<string, any>;
    }

    namespace Producer {
      function getCompressionMap(): Record<string, any>;
    }
  }
}
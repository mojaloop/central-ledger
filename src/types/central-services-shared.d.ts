import '@mojaloop/central-services-shared';

// TODO: put these upstream into central-services-shared.
declare module '@mojaloop/central-services-shared' {
  interface Util {
    Comparators: {
      duplicateCheckComparator(
        id: string,
        payload: object,
        getDuplicateFn: (id: string) => Promise<{ hash?: string; [key: string]: any } | null>,
        saveDuplicateHashFn: (id: string, hash: string) => Promise<void>,
        options?: { hashRecordProperty?: string }
      ): Promise<{
        hasDuplicateId: boolean;
        hasDuplicateHash: boolean;
      }>;
    };
    Time: {
      getUTCString(date: Date): string;
    }
  }

  interface Kafka {
    proceed(
      kafkaConfig: any,
      params: {
        message: any;
        kafkaTopic: string;
        decodedPayload?: any;
        span?: any;
        consumer: any;
        producer: any;
      },
      options: {
        consumerCommit?: boolean;
        eventDetail?: {
          functionality: string;
          action: string;
        };
        fspiopError?: any;
        fromSwitch?: boolean;
        toDestination?: string;
        messageKey?: string;
        topicNameOverride?: string | null,
        hubName?: string;
      }
    ): Promise<void>;
  }
}

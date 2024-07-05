module.exports = {
  HOSTNAME: 'http://central-ledger',
  DATABASE: {
    HOST: 'mysql'
  },
  MONGODB: {
    DISABLED: false,
    DEBUG: false,
    HOST: 'objstore',
    PORT: 27017,
    USER: '',
    PASSWORD: '',
    DATABASE: 'mlos'
  },
  KAFKA: {
    EVENT_TYPE_ACTION_TOPIC_MAP: {
      POSITION: {
        PREPARE: 'topic-transfer-position-batch',
        BULK_PREPARE: null,
        COMMIT: 'topic-transfer-position-batch',
        BULK_COMMIT: null,
        RESERVE: 'topic-transfer-position-batch'
      }
    },
    CONSUMER: {
      BULK: {
        PREPARE: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        },
        PROCESSING: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        },
        FULFIL: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        },
        GET: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        }
      },
      TRANSFER: {
        PREPARE: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        },
        GET: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        },
        FULFIL: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        },
        POSITION: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        },
        POSITION_BATCH: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        }
      },
      ADMIN: {
        TRANSFER: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        }
      }
    },
    PRODUCER: {
      BULK: {
        PROCESSING: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        }
      },
      TRANSFER: {
        PREPARE: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        },
        FULFIL: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        },
        POSITION: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        }
      },
      NOTIFICATION: {
        EVENT: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        }
      },
      ADMIN: {
        TRANSFER: {
          config: {
            rdkafkaConf: {
              'metadata.broker.list': 'kafka:29092'
            }
          }
        }
      }
    }
  }
}

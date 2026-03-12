import { PubSub } from '@google-cloud/pubsub';
import { config } from '../config';

const pubsub = new PubSub({
  projectId: config.gcpProjectId || 'mystweaver-local',
});

export const flagUpdatesTopic = pubsub.topic(config.pubsubTopic);
export { pubsub };

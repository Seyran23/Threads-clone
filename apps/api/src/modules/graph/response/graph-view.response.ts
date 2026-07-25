import { GraphEdgeResponse } from './graph-edge.response';
import { GraphUserResponse } from './graph-user.response';

export class GraphViewResponse {
  nodes!: GraphUserResponse[];
  edges!: GraphEdgeResponse[];
}

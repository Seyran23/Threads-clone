export interface GraphUser {
  id: string;
  username: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphViewData {
  nodes: GraphUser[];
  edges: GraphEdge[];
}

export interface ShortestPathResult {
  path: GraphUser[] | null;
  length: number | null;
}

export interface InfluenceResult {
  userId: string;
  reach: number;
}

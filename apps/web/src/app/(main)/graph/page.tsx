'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';

import { getGraphView, getInfluence, getMutuals, getShortestPath } from '@/lib/api/graph';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { queryKeys } from '@/lib/query-keys';

// react-force-graph-2d's generics don't survive next/dynamic's type inference, so the
// node/link render-prop callbacks below are typed explicitly instead.
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
}) as unknown as ComponentType<Record<string, unknown>>;

const COLOR_BG = 'oklch(0.145 0 0)';
const COLOR_LINK = 'oklch(1 0 0 / 20%)';
const COLOR_LABEL = 'oklch(0.985 0 0)';

/** Deterministic hue per user id, so a node's color is stable and consistent across renders. */
function hueForUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function colorForUserId(userId: string): string {
  return `oklch(0.75 0.15 ${hueForUserId(userId)})`;
}

function nodeRadius(
  node: GraphNode,
  currentUserId: string | undefined,
  degreeById: Map<string, number>,
): number {
  if (node.id === currentUserId) {
    return 10;
  }
  return 3 + Math.min(degreeById.get(node.id) ?? 0, 6);
}

interface GraphNode {
  id: string;
  username: string;
  x?: number;
  y?: number;
}

function useContainerWidth() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => setWidth(containerRef.current?.clientWidth ?? 0);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return { containerRef, width };
}

function NodeDetailsPanel({
  userId,
  username,
  onClose,
}: {
  userId: string;
  username: string;
  onClose: () => void;
}) {
  const detailsQuery = useQuery({
    queryKey: queryKeys.nodeDetails(userId),
    queryFn: async () => {
      const [mutuals, shortestPath, influence] = await Promise.all([
        getMutuals(userId),
        getShortestPath(userId),
        getInfluence(userId),
      ]);
      return { mutuals, shortestPath, influence };
    },
  });

  return (
    <div className="absolute top-4 right-4 z-10 w-72 rounded-xl border border-border bg-popover p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/profile/${username}`} className="text-base font-semibold hover:underline">
          {username}
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {detailsQuery.isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
      {detailsQuery.isError && (
        <p className="mt-3 text-sm text-destructive">Couldn&apos;t load details.</p>
      )}

      {detailsQuery.data && (
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="font-medium">
              {detailsQuery.data.shortestPath.length === null
                ? 'No path to you'
                : detailsQuery.data.shortestPath.length === 1
                  ? 'Directly connected'
                  : `${detailsQuery.data.shortestPath.length} degrees away`}
            </p>
            {detailsQuery.data.shortestPath.path && (
              <p className="mt-1 text-muted-foreground">
                {detailsQuery.data.shortestPath.path.map((u) => u.username).join(' → ')}
              </p>
            )}
          </div>

          <div>
            <p className="font-medium">
              {detailsQuery.data.mutuals.length} mutual connection
              {detailsQuery.data.mutuals.length === 1 ? '' : 's'}
            </p>
            {detailsQuery.data.mutuals.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                {detailsQuery.data.mutuals.map((u) => u.username).join(', ')}
              </p>
            )}
          </div>

          <p className="font-medium">Reach: {detailsQuery.data.influence.reach}</p>
        </div>
      )}
    </div>
  );
}

export default function GraphViewPage() {
  const { data: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.user.id;
  const { containerRef, width } = useContainerWidth();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const graphQuery = useQuery({
    queryKey: queryKeys.graphView(currentUserId ?? ''),
    queryFn: () => getGraphView(currentUserId!),
    enabled: !!currentUserId,
  });

  const degreeById = useMemo(() => {
    const degrees = new Map<string, number>();
    for (const edge of graphQuery.data?.edges ?? []) {
      degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
      degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
    }
    return degrees;
  }, [graphQuery.data]);

  const graphData = useMemo(
    () => ({
      nodes: graphQuery.data?.nodes ?? [],
      links: (graphQuery.data?.edges ?? []).map((e) => ({ source: e.source, target: e.target })),
    }),
    [graphQuery.data],
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.id === currentUserId) {
        return;
      }
      setSelectedNode(node);
    },
    [currentUserId],
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Link href="/" aria-label="Back to feed">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-base font-semibold">Network</h1>
      </div>

      <div ref={containerRef} className="relative min-h-[300px]">
        {graphQuery.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {graphQuery.isError && (
          <p className="p-4 text-sm text-destructive">Couldn&apos;t load your network.</p>
        )}
        {graphQuery.data && graphQuery.data.nodes.length <= 1 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Follow some people to see your network graph.
          </p>
        )}

        {graphQuery.data && graphQuery.data.nodes.length > 1 && width > 0 && (
          <ForceGraph2D
            graphData={graphData}
            width={width}
            height={600}
            backgroundColor={COLOR_BG}
            nodeId="id"
            nodeLabel="username"
            nodeVal={(node: GraphNode) => nodeRadius(node, currentUserId, degreeById)}
            nodeColor={(node: GraphNode) => colorForUserId(node.id)}
            nodeCanvasObjectMode={() => 'after'}
            nodeCanvasObject={(
              node: GraphNode,
              ctx: CanvasRenderingContext2D,
              globalScale: number,
            ) => {
              if (node.x === undefined || node.y === undefined) {
                return;
              }

              if (node.id === currentUserId) {
                ctx.beginPath();
                ctx.arc(
                  node.x,
                  node.y,
                  nodeRadius(node, currentUserId, degreeById),
                  0,
                  2 * Math.PI,
                );
                ctx.lineWidth = 1.5 / globalScale;
                ctx.strokeStyle = COLOR_LABEL;
                ctx.stroke();
              }

              if (globalScale >= 0.6) {
                const fontSize = 12 / globalScale;
                const radius = nodeRadius(node, currentUserId, degreeById);
                ctx.font = `${fontSize}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = COLOR_LABEL;
                ctx.fillText(node.username, node.x, node.y + radius + 2);
              }
            }}
            linkColor={() => COLOR_LINK}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            onNodeClick={handleNodeClick}
          />
        )}
        {selectedNode && (
          <NodeDetailsPanel
            userId={selectedNode.id}
            username={selectedNode.username}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-border p-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full border border-foreground" />
          You (ringed)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-muted-foreground" />
          Each person has their own color · larger = more mutual links
        </span>
      </div>
    </div>
  );
}

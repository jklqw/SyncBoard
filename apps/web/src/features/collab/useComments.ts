import { useCallback, useEffect, useState } from 'react';
import type { CommentDto } from '@syncboard/shared';
import { boardsApi } from '../../app/api';
import type { CreateCommentInput } from '../../app/api/boards';

export interface CommentsApi {
  comments: CommentDto[];
  loading: boolean;
  add: (input: CreateCommentInput) => Promise<void>;
  resolve: (commentId: string, resolved: boolean) => Promise<void>;
  reload: () => Promise<void>;
}

export function useComments(boardId: string): CommentsApi {
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setComments(await boardsApi.comments(boardId));
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live comment broadcasts arrive over the board WebSocket as JSON frames.
  useEffect(() => {
    const onEvent = (): void => {
      void reload();
    };
    window.addEventListener('syncboard:comment', onEvent);
    return () => window.removeEventListener('syncboard:comment', onEvent);
  }, [reload]);

  const add = useCallback(
    async (input: CreateCommentInput) => {
      const created = await boardsApi.createComment(boardId, input);
      setComments((current) => [...current, created]);
    },
    [boardId],
  );

  const resolve = useCallback(
    async (commentId: string, resolved: boolean) => {
      const updated = await boardsApi.resolveComment(boardId, commentId, resolved);
      setComments((current) => current.map((comment) => (comment.id === updated.id ? updated : comment)));
    },
    [boardId],
  );

  return { comments, loading, add, resolve, reload };
}

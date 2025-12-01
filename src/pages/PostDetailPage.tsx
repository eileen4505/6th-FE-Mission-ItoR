// src/pages/PostDetailPage.tsx
import React, { useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";

import TitleSection, { AuthorView } from "@ui/post/TitleSection";
import DetailBlocks, { DetailBlock } from "@ui/post/DetailBlocks";
import CommentInput from "@ui/post/CommentInput";
import ConfirmDialog from "@ui/ConfirmDialog";
import CommentList from "@ui/comment/CommentList";
import type { CommentView } from "@ui/comment/CommentItem";

import { usePostDetail, useDeletePost } from "@src/hooks/usePosts";
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from "@src/hooks/useComments";
import { useAuthStatus } from "@src/hooks/useAuthStatus";

import Spacer from "@ui/Spacer";
import Modal from "@ui/Modal";
import PostDetailHeader from "@src/components/ui/post/PostDetailHeader";
import PostAuthorSection from "@src/components/ui/post/PostAuthorSection";

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${month} ${d.getDate()}, ${d.getFullYear()}.`;
};

type ApiPostDetail = {
  id: string;
  title: string;
  createdAt?: string;
  author?: {
    nickname?: string;
    avatarUrl?: string;
    introduction?: string;
  };
  blocks?: Array<
    | { type: "IMAGE"; order: number; url: string }
    | { type: "TEXT"; order: number; content: string }
  >;
  mine?: boolean;
};

// 🚩 래퍼 컴포넌트: 여기선 훅 거의 안 쓰고 id 체크만 함
export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <Navigate to="/" replace />;
  }

  return <PostDetailPageContent id={id} />;
}

// 실제 내용 컴포넌트: 여기에서만 훅들을 사용
type ContentProps = {
  id: string;
};

function PostDetailPageContent({ id }: ContentProps) {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStatus();

  const pid = id;
  const { data, isLoading, isError } = usePostDetail(pid);
  const { data: serverComments = [] } = useComments(pid);
  const createMut = useCreateComment(pid);
  const updateMut = useUpdateComment(pid);
  const deleteMut = useDeleteComment(pid);
  const deletePostMut = useDeletePost(pid);

  const [input, setInput] = useState("");
  const [postDeleteOpen, setPostDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const d = data as ApiPostDetail | undefined;

  const author: AuthorView | null = d
    ? {
        name: d.author?.nickname ?? "익명",
        initial: (d.author?.nickname ?? "U").charAt(0).toUpperCase(),
      }
    : null;

  const blocks: DetailBlock[] = Array.isArray(d?.blocks)
    ? d.blocks.map((b) =>
        b.type === "IMAGE"
          ? { type: "IMAGE", order: b.order, value: b.url }
          : { type: "TEXT", order: b.order, value: b.content }
      )
    : [];

  const dateText = d?.createdAt ? formatDate(d.createdAt) : "";
  const isMine = !!d?.mine;

  type ServerCommentFlexible = {
    id?: number;
    commentId?: number;
    content?: string;
    createdAt?: string;
    author?: { nickname?: string; avatarUrl?: string };
    nickName?: string;
    profileUrl?: string;
    mine?: boolean;
    isOwner?: boolean;
  };

  const comments: CommentView[] = (serverComments as ServerCommentFlexible[]).map(
    (c) => ({
      id: (c.id ?? c.commentId ?? 0) as number,
      content: String(c.content ?? ""),
      createdAt: c.createdAt ?? new Date().toISOString(),
      nickname: c.author?.nickname ?? c.nickName ?? "익명",
      profileUrl: c.author?.avatarUrl ?? c.profileUrl,
      mine: Boolean(c.mine ?? c.isOwner),
    })
  );

  if (isLoading) {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center text-[14px] text-[var(--Gray56)]">
        로딩 중입니다...
      </div>
    );
  }

  if (isError || !d || !author) {
    return <Navigate to="/" replace />;
  }

  const handleCreate = () => {
    const v = input.trim();
    if (!v || !isLoggedIn) return;
    createMut.mutate(v, {
      onSuccess: () => setInput(""),
    });
  };

  const askDelete = (cid: number) => setDeleteId(cid);

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteMut.mutate(deleteId, {
      onSettled: () => setDeleteId(null),
    });
  };

  const saveEdit = (cid: number, content: string) =>
    updateMut.mutate({ commentId: cid, content });

  return (
    <div className="min-h-dvh w-full flex flex-col bg-[var(--White)]">
      <PostDetailHeader
        isMine={isMine}
        onEdit={() => navigate(`/write/${id}`)}
        onDelete={() => setPostDeleteOpen(true)}
      />

      <main className="flex-1 w-full">
        <div className="mx-auto w-full max-w-[688px]">
          <TitleSection
            title={d.title}
            author={author}
            date={dateText}
            commentCount={comments.length}
          />
          <Spacer y={32} />
          <DetailBlocks blocks={blocks} />
          <Spacer y={32} />

          <section className="flex flex-col items-start gap-10 flex-[1_0_0]">
            <CommentInput
              isLoggedIn={isLoggedIn}
              value={input}
              onChange={setInput}
              onSubmit={handleCreate}
            />
            <CommentList
              comments={comments}
              onDelete={askDelete}
              onEdit={saveEdit}
            />
            <Spacer y={64} />
          </section>
        </div>

        <PostAuthorSection
          name={author.name}
          initial={author.initial}
          introduction={d.author?.introduction}
        />
      </main>

      <Modal
        open={postDeleteOpen}
        onClose={() => setPostDeleteOpen(false)}
        onCancel={() => setPostDeleteOpen(false)}
        onConfirm={() => {
          deletePostMut.mutate(undefined, {
            onSuccess: () => navigate("/", { replace: true }),
            onSettled: () => setPostDeleteOpen(false),
          });
        }}
        titleLines={["해당 블로그를 삭제하시겠어요?"]}
        descriptionLines={["삭제된 블로그는 다시 확인할 수 없어요."]}
        confirmText="삭제하기"
        cancelText="취소"
        confirmVariant="negative"
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="댓글을 삭제하시겠어요?"
        description="삭제 후에는 복구할 수 없어요."
        confirmText="삭제"
        variant="negative"
      />
    </div>
  );
}

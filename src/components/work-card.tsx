import { memo } from "react";
import {
  CalendarDays,
  Download,
  Eye,
  MessageSquare,
  Pencil,
  Share2,
  Star,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, WORK_TYPE_LABEL, type WorkRecord } from "@/lib/study";

type Props = {
  work: WorkRecord;
  canManage: boolean;
  bookmarked: boolean;
  onBookmark: () => void;
  onView: () => void;
  onDownload: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function WorkCardBase({
  work,
  canManage,
  bookmarked,
  onBookmark,
  onView,
  onDownload,
  onShare,
  onEdit,
  onDelete,
}: Props) {
  return (
    <article className="group relative flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="absolute inset-y-4 left-3 w-px bg-paper-margin" aria-hidden />

      <div className="flex items-start justify-between gap-3 pl-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg leading-snug font-semibold text-foreground">
            {work.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">by {work.uploader_name}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBookmark}
            aria-label={bookmarked ? `Remove ${work.title} from starred` : `Star ${work.title}`}
            title={bookmarked ? "Remove from starred" : "Star for revision"}
          >
            <Star
              className={
                bookmarked ? "size-4 fill-highlight text-highlight" : "size-4 text-muted-foreground"
              }
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onShare}
            aria-label={`Share ${work.title}`}
            title="Copy share link"
          >
            <Share2 className="size-4 text-teal" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-3">
        <Badge variant="secondary">{work.subject}</Badge>
        {work.subtype ? <Badge variant="outline">{work.subtype}</Badge> : null}
        <Badge className="bg-highlight text-highlight-foreground hover:bg-highlight">
          {WORK_TYPE_LABEL[work.work_type]}
        </Badge>
      </div>

      <div className="mt-3 flex items-center gap-4 pl-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5" />
          {formatDate(work.created_at)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3.5" />
          {work.comment_count} {work.comment_count === 1 ? "comment" : "comments"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 pl-3">
        <Button size="sm" onClick={onView}>
          <Eye className="size-4" />
          View
        </Button>
        <Button size="sm" variant="outline" onClick={onDownload}>
          <Download className="size-4" />
          Download
        </Button>
        {canManage ? (
          <>
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}

export const WorkCard = memo(WorkCardBase);

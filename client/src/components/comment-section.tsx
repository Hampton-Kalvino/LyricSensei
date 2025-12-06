import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageCircle, Send, Trash2, User, LogIn, Reply, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { CommentWithUser } from "@shared/schema";

interface CommentSectionProps {
  songId: string;
  className?: string;
}

export function CommentSection({ songId, className }: CommentSectionProps) {
  const { t } = useTranslation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<CommentWithUser | null>(null);

  const { data: comments = [], isLoading: isLoadingComments } = useQuery<CommentWithUser[]>({
    queryKey: ['/api/comments', songId],
    queryFn: async () => {
      const response = await fetch(`/api/comments/${songId}`);
      if (!response.ok) throw new Error("Failed to fetch comments");
      return response.json();
    },
    enabled: !!songId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ text, parentId }: { text: string; parentId?: string }) => {
      return apiRequest('POST', `/api/comments/${songId}`, { text, parentId });
    },
    onSuccess: () => {
      setCommentText("");
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['/api/comments', songId] });
      toast({
        title: replyingTo ? "Reply posted" : "Comment posted",
        description: replyingTo ? "Your reply has been added." : "Your comment has been added.",
      });
    },
    onError: (error: any) => {
      if (error?.requiresLogin) {
        toast({
          title: "Login required",
          description: "Please sign in to post comments.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to post comment",
          variant: "destructive",
        });
      }
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest('DELETE', `/api/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/comments', songId] });
      toast({
        title: "Comment deleted",
        description: "Your comment has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete comment",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    
    if (!user || user.isGuest) {
      toast({
        title: "Login required",
        description: "Please sign in to post comments.",
        variant: "destructive",
      });
      return;
    }
    
    addCommentMutation.mutate({ 
      text: commentText.trim(), 
      parentId: replyingTo?.id 
    });
  };

  const handleReply = (comment: CommentWithUser) => {
    if (!user || user.isGuest) {
      toast({
        title: "Login required",
        description: "Please sign in to reply to comments.",
        variant: "destructive",
      });
      return;
    }
    setReplyingTo(comment);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getUserDisplayName = (comment: CommentWithUser) => {
    if (comment.user.username) return comment.user.username;
    if (comment.user.firstName && comment.user.lastName) {
      return `${comment.user.firstName} ${comment.user.lastName}`;
    }
    if (comment.user.firstName) return comment.user.firstName;
    return "User";
  };

  const getUserInitials = (comment: CommentWithUser) => {
    const name = getUserDisplayName(comment);
    return name.slice(0, 2).toUpperCase();
  };

  const isGuest = !user || user.isGuest;

  const renderComment = (comment: CommentWithUser, isReply: boolean = false) => (
    <div 
      key={comment.id} 
      className={cn("flex gap-3 group", isReply && "ml-8 mt-3")}
      data-testid={`comment-${comment.id}`}
    >
      <Avatar className={cn("flex-shrink-0", isReply ? "h-7 w-7" : "h-9 w-9")}>
        <AvatarImage src={comment.user.profileImageUrl || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs">
          {getUserInitials(comment)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("font-medium truncate", isReply ? "text-xs" : "text-sm")} data-testid={`text-comment-author-${comment.id}`}>
            {getUserDisplayName(comment)}
          </span>
          <span className="text-xs text-muted-foreground" data-testid={`text-comment-time-${comment.id}`}>
            {formatTimeAgo(comment.createdAt.toString())}
          </span>
          {user && user.id === comment.userId && !user.isGuest && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => deleteCommentMutation.mutate(comment.id)}
              disabled={deleteCommentMutation.isPending}
              data-testid={`button-delete-comment-${comment.id}`}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </Button>
          )}
        </div>
        <p className={cn("text-foreground/90 mt-1 whitespace-pre-wrap break-words", isReply ? "text-xs" : "text-sm")} data-testid={`text-comment-content-${comment.id}`}>
          {comment.text}
        </p>
        {!isReply && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 mt-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => handleReply(comment)}
            data-testid={`button-reply-${comment.id}`}
          >
            <Reply className="h-3 w-3 mr-1" />
            Reply
          </Button>
        )}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 space-y-2 border-l-2 border-border/50 pl-2">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Card className={cn("p-4", className)} data-testid="comment-section">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-sm" data-testid="text-comments-heading">Comments</h3>
        {comments.length > 0 && (
          <span className="text-xs text-muted-foreground">({comments.length})</span>
        )}
      </div>

      {isGuest ? (
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Join the conversation</p>
              <p className="text-xs text-muted-foreground">
                Sign in to share your thoughts about this song
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setLocation("/login")}
              className="gap-2"
              data-testid="button-login-to-comment"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mb-4">
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-muted/50 rounded-md">
              <Reply className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground flex-1">
                Replying to <span className="font-medium text-foreground">{getUserDisplayName(replyingTo)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setReplyingTo(null)}
                data-testid="button-cancel-reply"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex gap-3">
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {user?.username?.slice(0, 2).toUpperCase() || 
                 user?.firstName?.slice(0, 1).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={replyingTo ? "Write a reply..." : "Share your thoughts about this song..."}
                className="min-h-[80px] resize-none text-sm"
                maxLength={500}
                data-testid="input-comment"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {commentText.length}/500
                </span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!commentText.trim() || addCommentMutation.isPending}
                  className="gap-2"
                  data-testid="button-submit-comment"
                >
                  <Send className="h-4 w-4" />
                  {addCommentMutation.isPending ? "Posting..." : replyingTo ? "Reply" : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      {isLoadingComments ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No comments yet</p>
          <p className="text-xs mt-1">Be the first to share your thoughts!</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4 pr-2">
            {comments.map((comment) => renderComment(comment))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}

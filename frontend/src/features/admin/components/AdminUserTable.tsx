import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AdminUser } from "@/types";

interface AdminUserTableProps {
  users: AdminUser[];
  onToggleBan: (user: AdminUser) => void;
  onChangeRole: (userId: string, role: string) => void;
  onDeleteUser?: (userId: string) => Promise<void>;
}

export function AdminUserTable({
  users,
  onToggleBan,
  onChangeRole,
  onDeleteUser,
}: AdminUserTableProps) {
  const { t } = useTranslation();
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!userToDelete || !onDeleteUser) return;
    try {
      setDeleting(true);
      await onDeleteUser(userToDelete.id);
      setUserToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>{t("admin.table.name")}</TableHead>
              <TableHead>{t("admin.table.email")}</TableHead>
              <TableHead>{t("admin.table.role")}</TableHead>
              <TableHead>{t("admin.table.status")}</TableHead>
              <TableHead className="text-right">
                {t("admin.table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={(value) => onChangeRole(user.id, value)}
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">{t("admin.role.user")}</SelectItem>
                      <SelectItem value="admin">
                        {t("admin.role.admin")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge variant={user.banned ? "destructive" : "secondary"}>
                    {user.banned
                      ? t("admin.status.banned")
                      : t("admin.status.active")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant={user.banned ? "default" : "destructive"}
                    onClick={() => onToggleBan(user)}
                  >
                    {user.banned
                      ? t("admin.action.unban")
                      : t("admin.action.ban")}
                  </Button>
                  {onDeleteUser && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setUserToDelete(user)}
                    >
                      {t("admin.action.delete")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.action.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.action.deleteConfirm", { name: userToDelete?.name || userToDelete?.email || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel", "Hủy")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? t("common.deleting", "Đang xoá...") : t("admin.action.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

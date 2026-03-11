import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, UserCog, Shield, Eye, Settings2 } from "lucide-react";
import { formatBRT } from "@/lib/date";

interface UserItem {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
}

const roleLabels: Record<string, string> = { admin: "Administrador", operator: "Operador", viewer: "Visualizador" };
const roleColors: Record<string, string> = { admin: "bg-red-500/10 text-red-500 border-red-500/30", operator: "bg-blue-500/10 text-blue-500 border-blue-500/30", viewer: "bg-gray-500/10 text-gray-400 border-gray-500/30" };

export default function Users() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState({ username: "", password: "", displayName: "", role: "operator" as string });

  const { data: users = [], isLoading } = useQuery<UserItem[]>({ queryKey: ["/api/users"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/users", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDialogOpen(false);
      toast({ title: "Usuário criado" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const data: any = { displayName: form.displayName, role: form.role };
      if (form.password) data.password = form.password;
      const res = await apiRequest("PATCH", `/api/users/${editUser!.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditUser(null);
      setDialogOpen(false);
      toast({ title: "Usuário atualizado" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuário excluído" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, { active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });

  const openCreate = () => {
    setEditUser(null);
    setForm({ username: "", password: "", displayName: "", role: "operator" });
    setDialogOpen(true);
  };

  const openEdit = (u: UserItem) => {
    setEditUser(u);
    setForm({ username: u.username, password: "", displayName: u.displayName || "", role: u.role });
    setDialogOpen(true);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Gerenciar Usuários</h1>
            <p className="text-sm text-muted-foreground">Controle de acesso ao sistema</p>
          </div>
          <Button onClick={openCreate} data-testid="button-create-user">
            <Plus className="w-4 h-4 mr-1" />
            Novo Usuário
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="grid gap-3">
            {users.map((u) => (
              <Card key={u.id} data-testid={`card-user-${u.id}`}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                      {u.role === "admin" ? <Shield className="w-4 h-4" /> : u.role === "operator" ? <Settings2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {u.displayName || u.username}
                        {!u.active && <Badge variant="destructive" className="text-[9px]">Inativo</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">@{u.username}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${roleColors[u.role] || ""}`}>
                      {roleLabels[u.role] || u.role}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {u.lastLoginAt ? `Último login: ${new Date(u.lastLoginAt).toLocaleDateString("pt-BR")}` : "Nunca logou"}
                    </span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(u)} data-testid={`button-edit-user-${u.id}`}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Excluir este usuário?")) deleteMutation.mutate(u.id); }} data-testid={`button-delete-user-${u.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
              <DialogDescription>{editUser ? "Atualize os dados do usuário" : "Crie um novo usuário do sistema"}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!editUser && (
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="nome_usuario" data-testid="input-new-username" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Nome de Exibição</Label>
                <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Nome Completo" data-testid="input-display-name" />
              </div>
              <div className="space-y-2">
                <Label>{editUser ? "Nova Senha (deixe vazio para manter)" : "Senha"}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" data-testid="input-new-password" />
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="operator">Operador</SelectItem>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => editUser ? updateMutation.mutate() : createMutation.mutate()}
                disabled={(!editUser && (!form.username || !form.password)) || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-user"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editUser ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Network } from "lucide-react";

interface LoginProps {
  onLogin: (user: { id: string; username: string; displayName: string; role: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      return res.json();
    },
    onSuccess: (data) => {
      onLogin(data);
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Credenciais inválidas", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Network className="w-8 h-8 text-primary" />
            <CardTitle className="text-2xl font-bold">NetControl ACS</CardTitle>
          </div>
          <CardDescription>Gerenciamento de Rede</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(); }} className="space-y-4" data-testid="form-login">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
                data-testid="input-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending || !username || !password} data-testid="button-login">
              {loginMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }: any) => {
        if (session) {
          window.location.replace("/accueil");
        } else {
          toast.info("L'accès se fait sans mot de passe. Veuillez créer un profil.");
          navigate({ to: "/inscription" });
        }
      });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 text-center">
      <div className="animate-pulse">Vérification de la session...</div>
    </div>
  );
}

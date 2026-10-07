"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Toaster, toast } from "sonner";

/**
 * Mostra toasts a partir dos parâmetros ?success= / ?error= no URL
 * (escritos pelas server actions) e limpa o URL de seguida.
 */
export function FeedbackToaster() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success) toast.success(success);
    if (error) toast.error(error);
    if (success || error) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("success");
      params.delete("error");
      const query = params.toString();
      router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return <Toaster richColors position="top-right" />;
}

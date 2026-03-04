import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | NetControl ACS`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", `${title} - Gerenciamento de dispositivos de rede`);
    }
  }, [title]);
}

import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { OrdersHomeProjection } from "@/modules/orders/public";
import { OfficeHome } from "@/components/home/OfficeHome";

type HomeAppAdapterProps = {
  authorization: AuthorizationSnapshot;
  source?: OrdersHomeProjection["source"];
};

export async function HomeAppAdapter({ authorization }: HomeAppAdapterProps) {
  return <OfficeHome authorization={authorization} />;
}

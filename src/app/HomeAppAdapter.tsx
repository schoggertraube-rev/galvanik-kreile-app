import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { OrdersHomeProjection } from "@/modules/orders/public";
import { RolfHome } from "@/components/home/RolfHome";

type HomeAppAdapterProps = {
  authorization: AuthorizationSnapshot;
  source?: OrdersHomeProjection["source"];
};

export async function HomeAppAdapter({ authorization }: HomeAppAdapterProps) {
  return <RolfHome authorization={authorization} />;
}

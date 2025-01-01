import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Page, Card, DataTable, Button } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { TitleBar } from "@shopify/app-bridge-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const query = `
    query getOrders {
      orders(first: 10, query: "fulfillment_status:unfulfilled") {
        edges {
          node {
            id
            name
            createdAt
            cartDiscountAmountSet {
              presentmentMoney {
                amount
              }
            }
            currentSubtotalPriceSet {
              presentmentMoney {
                amount
              }
            }
            customer {
              firstName
              lastName
              email
            }
            lineItems(first: 5) {
              edges {
                node {
                  title
                  quantity
                  variant {
                    displayName
                  }
                  discountedUnitPriceSet {
                    presentmentMoney {
                      amount
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await admin.graphql(query);
  const ordersData = await response.json();
  const orders = ordersData.data.orders.edges.map((order: any) => {
    const orderSubtotal = parseFloat(
      order.node.currentSubtotalPriceSet.presentmentMoney.amount,
    );

    const orderDiscount = parseFloat(
      order.node.cartDiscountAmountSet?.presentmentMoney.amount,
    );

    let subtotal = orderSubtotal;
    if (!isNaN(orderDiscount)) {
      // The subtotal is after discounts applied, un-apply the discount for clarity
      subtotal += orderDiscount;
    }

    return {
      id: order.node.id,
      name: order.node.name || "Guest",
      created: order.node.createdAt,
      subtotal: subtotal,
      customer: `${order.node.customer?.firstName || "Guest"} ${order.node.customer?.lastName || ""}`,
      email: order.node.customer?.email || "N/A",
      items: order.node.lineItems.edges.map((lineItem: any) => ({
        title:
          lineItem.node.variant?.displayName || lineItem.node.title,
        quantity: lineItem.node.quantity,
        price: lineItem.node.discountedUnitPriceSet.presentmentMoney
          .amount,
      })),
    };
  });

  return orders;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
};

export default function Index() {
  const orders = useLoaderData<typeof loader>();

  const navigate = useNavigate();

  const rows = orders.map((order: any) => {
    return [
      order.name,
      order.customer,
      order.email,
      new Date(order.created).toLocaleString(),
      `${order.items[0].quantity} x ${order.items[0].title.replace(" - Default Title", "")} @ $${parseFloat(order.items[0].price).toFixed(2)}/lb`,
      `$${parseFloat(order.subtotal).toFixed(2)}`,
      <Button
        variant="primary"
        key={order.id + order.email}
        onClick={() => {
          navigate(
            `/app/orders/${order.id.replace("gid://shopify/Order/", "")}`,
          );
        }}
      >
        Edit Order
      </Button>,
    ];
  });

  const columns = [
    "Order",
    "Customer",
    "Email",
    "Created At",
    "First Item",
    "Subtotal",
    "Edit Order",
  ];
  return (
    <Page fullWidth>
      <TitleBar title="Unfulfilled Orders" />
      <Card>
        <DataTable
          columnContentTypes={[
            "text",
            "text",
            "text",
            "text",
            "text",
            "text",
            "text",
          ]}
          headings={columns}
          rows={rows}
        />
      </Card>
    </Page>
  );
}

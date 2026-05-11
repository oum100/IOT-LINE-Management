import { createError, getRouterParam } from "h3";
import { prisma } from "../../../../utils/prisma";
import { assertPermission } from "../../../../utils/rbac";

type TimelineEvent = {
  id: string;
  at: Date | string | null;
  title: string;
  note: string;
  tone: "neutral" | "primary" | "success" | "warning" | "error";
};

export default defineEventHandler(async (event) => {
  await assertPermission(event, "platform.order.read");

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Order id is required",
    });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      payment: {
        include: {
          slips: {
            orderBy: { uploadedAt: "asc" },
          },
        },
      },
    },
  });

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: "Order not found" });
  }

  const events: TimelineEvent[] = [];
  events.push({
    id: `order-created-${order.id}`,
    at: order.createdAt,
    title: "Order Created",
    note: `Order ${order.orderNumber} created`,
    tone: "primary",
  });

  if (!order.payment) {
    events.push({
      id: `payment-missing-${order.id}`,
      at: order.updatedAt,
      title: "Payment Not Found",
      note: "No payment record attached to this order",
      tone: "error",
    });
  } else {
    events.push({
      id: `payment-created-${order.payment.id}`,
      at: order.payment.createdAt,
      title: "Payment Created",
      note: `Amount ${order.payment.amount}`,
      tone: "neutral",
    });

    for (const slip of order.payment.slips) {
      events.push({
        id: `payment-slip-${slip.id}`,
        at: slip.uploadedAt,
        title: "Slip Uploaded",
        note: slip.fileName || "Awaiting review",
        tone: "warning",
      });
    }

    if (order.payment.verifiedAt) {
      events.push({
        id: `payment-verified-${order.payment.id}`,
        at: order.payment.verifiedAt,
        title: "Payment Verified",
        note: "Payment verified successfully",
        tone: "success",
      });
    } else if (order.payment.status === "REJECTED") {
      events.push({
        id: `payment-rejected-${order.payment.id}`,
        at: order.payment.updatedAt,
        title: "Payment Rejected",
        note: order.payment.rejectedNote || "Rejected by system/admin",
        tone: "error",
      });
    } else {
      events.push({
        id: `payment-status-${order.payment.id}`,
        at: order.payment.updatedAt,
        title: `Payment ${order.payment.status}`,
        note: "Waiting for next payment action",
        tone: "neutral",
      });
    }
  }

  events.sort((a, b) => {
    const atA = a.at ? new Date(a.at).getTime() : 0;
    const atB = b.at ? new Date(b.at).getTime() : 0;
    return atA - atB;
  });

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      customerName: order.customerName,
      createdAt: order.createdAt,
    },
    payment: order.payment
      ? {
          id: order.payment.id,
          status: order.payment.status,
          amount: order.payment.amount,
          createdAt: order.payment.createdAt,
          updatedAt: order.payment.updatedAt,
          verifiedAt: order.payment.verifiedAt,
          rejectedNote: order.payment.rejectedNote,
        }
      : null,
    events,
  };
});

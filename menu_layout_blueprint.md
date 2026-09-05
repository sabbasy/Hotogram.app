# Hotogram Customer Menu — Architecture & Design Blueprint

This document contains the complete layout, responsive styling system, popups, and state machine specifications for the Hotogram Customer Menu. Use this blueprint to replicate the identical customer-facing experience in your new project.

---

## 🎨 1. Design & Aesthetic Tokens

The customer menu uses a premium, dark-mode glassmorphic interface with vibrant highlights and smooth micro-animations.

| Token | CSS Value / Tailwind Class | Role |
| :--- | :--- | :--- |
| **Main Background** | `#050505` / `bg-zinc-950` | Primary background color |
| **Surface (Card) Background** | `rgba(16, 16, 16, 0.6)` / `bg-zinc-900/60` | Glass container fills |
| **Active Accent Color** | `rgb(249, 115, 22)` / `text-orange-500` | CTA buttons, counts, active badges |
| **Borders** | `rgba(255, 255, 255, 0.08)` / `border-zinc-800/80` | Subtle hairline dividers |
| **Blur Effect** | `backdrop-filter: blur(12px)` | Glassmorphism on cards and drawers |

---

## 🧱 2. Core UI Layout Structure

The customer menu follows a single-page responsive layout suited for mobile web views (scanned via QR code).

### A. Header Navigation
*   **Logo & Restaurant Name:** Sleek typography with a gradient brand flash.
*   **Table ID Badge:** Persistent indicator showing the current table number (e.g. `Table 3`).
*   **Help Button:** Pulsing button that opens the **Assistance Dialog** (Call Waiter / Request Water / Get Bill).
*   **Cart Trigger:** Float-right bubble showing active items in the cart.

### B. Category Selector (Horizontal Scrolling Carousel)
*   **Properties:** `flex overflow-x-auto whitespace-nowrap scrollbar-hide`
*   **Aesthetics:** Active category uses high-contrast text and a bottom highlight line. Inactive categories remain muted.
*   **Filter Logic:** Selecting a category filters the menu list below. The first option is always `"All"`.

### C. Menu Grid / Product List
*   **Desktop layout:** `grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`
*   **Mobile layout:** `flex flex-col gap-4`
*   **Product Card Components:**
    *   Left/Top: Image placeholder with a fallback gradient.
    *   Right/Bottom: Title, description, price, and vegetarian badge.
    *   **Add Button:** If quantity is 0, displays a white button `+ Add`. If quantity > 0, transforms into a counter button (`-` quantity `+`) with orange accents.

---

## ⚙️ 3. Client State Machine

```mermaid
state-diagram-v2
    [*] --> LoadingData : Scan QR Link
    LoadingData --> SecurityMismatch : Invalid URL / Wrong Restaurant ID
    LoadingData --> EmptyMenu : Valid URL, No Active Session
    LoadingData --> ActiveSession : Valid URL, Session Exists
    
    EmptyMenu --> CartUpdated : Customer adds items
    ActiveSession --> CartUpdated : Customer adds items
    
    CartUpdated --> IdentityDialog : Click "Place Order" (Name/Phone required)
    IdentityDialog --> PlacingOrder : Click "Confirm"
    
    PlacingOrder --> OrderSuccessScreen : Order Created (API returns success)
    OrderSuccessScreen --> ActiveSession : Dismiss success popup
    
    ActiveSession --> CashSettleRequested : Click "Pay Cash" in Drawer
    ActiveSession --> CheckoutComplete : Click "Pay Online" (UPI/Card) or Waiter confirms Cash
    
    CashSettleRequested --> CheckoutComplete : Waiter Confirms Payment
    CheckoutComplete --> [*] : Table marked Vacant (Session closes)
```

---

## 💬 4. Interactive Components & Popups

### A. Need Assistance Popup (Modal)
*   **Trigger:** Click on the "Assistance / Bell" icon in the header.
*   **Actions:**
    1.  **Call Waiter** (`call_waiter`): Inserts request to `customer_requests`. Shows alert confirmation.
    2.  **Request Water** (`request_water`): Inserts request to `customer_requests`. Shows alert confirmation.
    3.  **Get Bill** (`request_bill`): Inserts request to `customer_requests`. Sets screen state to **Cash Settle Requested**.

### B. Checkout Identity Modal
*   **Trigger:** Customer clicks `Place Order` button and has no `customerName` or `customerPhone` stored in session storage.
*   **Fields:**
    *   Full Name (input, required)
    *   Phone Number (input, type tel, required)
*   **Design:** Floating glassmorphic panel matching inputs with white borders and bold confirmation button.

### C. Order Tracker Drawer (Slide-Over Panel)
*   **Properties:** Slides from the right on Desktop, bottom-up on Mobile (`y: 100%` to `y: 0` using `framer-motion`).
*   **Components:**
    *   **Active Orders List:** Groups items by order number. Displays statuses: `Accepted`, `Preparing` (pulsing indicator), `Ready to Serve`, or `Served`.
    *   **Bill Breakdown:** Lists subtotal, platform fee (`$1.50`), and the overall accumulated total of the session.
    *   **Settle Options:**
        *   *Online Settle:* Simulates gateway processing with loader before setting `payment_status` to `'paid'`.
        *   *Cash Settle:* Calls `request_bill` service request and locks the interface.

### D. Verification Warning Overlay (Connection Interrupted)
*   **Condition:** URL restaurant ID does not match the scanned table's restaurant ID.
*   **Aesthetics:** Red danger indicators, connection retry action button, and a block preventing any user interactions.

### E. Checkout Complete Overlay
*   **Condition:** `activeSession.payment_status === 'paid'`.
*   **Aesthetics:** High-contrast emerald badge. Closes order placement, locks page layout, and displays: `"Checkout Complete - Thank you! Your table session is now complete."`

### F. Cash Settle Pending Overlay
*   **Condition:** Customer selected Cash Settle or clicked Get Bill, and `payment_status` is still `'pending'`.
*   **Aesthetics:** Pulsing orange indicator, lock explanation, and a "Check Status" action button.

---

## 🛠️ 5. Implementation Code Reference

To recreate this layout in React/Next.js, structure your component endpoints exactly like the following templates:

### A. Customer Menu Page Route (`/src/app/menu/[restaurantId]/[tableId]/page.tsx`)
```typescript
import { MenuClient } from "@/components/menu/MenuClient";

interface PageProps {
  params: {
    restaurantId: string;
    tableId: string;
  };
}

export default async function MenuPage({ params }: PageProps) {
  const { restaurantId, tableId } = await params;
  return <MenuClient restaurantId={restaurantId} tableId={tableId} />;
}
```

### B. Success Screen Component Schema (`OrderSuccessScreen.tsx`)
```typescript
interface SuccessProps {
  visible: boolean;
  orderId: string;
  tableId: string; // Accepts Table Number (e.g. "Table 1")
  items: Array<{ name: string; quantity: number }>;
  total: number;
  onDismiss: () => void;
}
```

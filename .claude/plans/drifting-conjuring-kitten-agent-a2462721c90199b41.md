# Implementation Plan: Add to Cart System

## Overview
Implementation of a functional 'Add to Cart' system for the SmartReco project, mirroring the persistence pattern used by the Wishlist (localStorage) but providing global accessibility via a Context Provider.

## 1. Cart State Management
### Architecture
- **CartContext**: Create a new `CartContext` to manage the cart state globally. This ensures the Header and Product pages stay in sync.
- **Persistence**: Use `localStorage` with the key `smartreco:cart`.
- **Data Structure**: An array of objects to support quantities: `CartItem[]` where `CartItem = { id: number, quantity: number }`.

### Logic
- `addItem(productId: number)`: If item exists, increment quantity; else add new item with quantity 1.
- `removeItem(productId: number)`: Remove the item entirely.
- `updateQuantity(productId: number, delta: number)`: Increase/decrease quantity (ensure min 1).
- `clearCart()`: Empty the cart.
- `getTotalItems()`: Sum of all quantities.

## 2. Cart Integration
### PDP Page (`smartreco\frontend\app\products\[id]\page.tsx`)
- Wrap the component (or provide via `CartProvider` in layout).
- Replace the static "Add to Cart" button (line 147) with a call to `addItem(product.id)`.
- Add a visual feedback mechanism (e.g., a temporary "Added!" state or toast).

### Header (`smartreco\frontend\app\page.tsx` and layout)
- The `Header` is currently defined inside `page.tsx` but should ideally be in a shared component or layout. Since it's in `page.tsx`, we'll update it there.
- Add a `ShoppingCart` icon next to the `Heart` (wishlist) icon.
- Include a badge showing `getTotalItems()` total.
- Link the icon to `/cart`.

## 3. Cart Page/View
### Approach: Dedicated Page (`/cart`)
A dedicated page is preferred for a "proper" cart system to allow for detailed quantity management and price calculation.

### Design for `smartreco\frontend\app\cart\page.tsx`
- **Layout**:
  - **Item List**: Table or grid showing product image, title, brand, price, and quantity controls (+/-).
  - **Summary Section**:
    - Subtotal calculation.
    - Shipping/Tax placeholders.
    - Total price.
    - "Proceed to Checkout" button.
- **Integration**: 
  - The page will fetch the full product details for each ID in the cart using the `/api/products` endpoint or individual product calls.

## Implementation Steps
1. **Create `CartContext`**: Implement `CartProvider` and `useCart` hook.
2. **Update Layout**: Wrap the application in `CartProvider` (likely in `layout.tsx`).
3. **Header Update**: Add Cart icon and badge to `Header` component.
4. **PDP Update**: Make "Add to Cart" functional.
5. **Cart Page Implementation**: Create `/app/cart/page.tsx` with the defined layout.

## Critical Files for Implementation
- `smartreco\frontend\app\cart-context.tsx` (New)
- `smartreco\frontend\app\layout.tsx`
- `smartreco\frontend\app\page.tsx` (Header update)
- `smartreco\frontend\app\products\[id]\page.tsx` (Button update)
- `smartreco\frontend\app\cart\page.tsx` (New)

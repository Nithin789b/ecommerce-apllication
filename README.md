# E-commerce Backend

Express and MongoDB API. The current platform has two account roles: `USER` and `ADMIN`. Users can browse active products; only admins can create products. The Seller model is currently a schema scaffold and is not connected to routes yet.

## Run locally

1. Install dependencies with `npm install`.
2. Start MongoDB and set `MONGO_URI` in `.env`.
3. Set token secrets, then run `npm run dev`.

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/ecommerce
ACCESS_TOKEN_SECRET=use-a-long-random-secret
REFRESH_TOKEN_SECRET=use-a-different-long-random-secret
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
NODE_ENV=development
CLIENT_URL=http://localhost:3000
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
CLOUDINARY_UPLOAD_TIMEOUT_MS=120000
```

Base URL: `http://localhost:5000`. Login and refresh use an HTTP-only `refreshToken` cookie; Postman retains it in its cookie jar. Product text fields can be sent as JSON or multipart form-data. Product image uploads use Cloudinary; only Cloudinary `secure_url` strings are saved in MongoDB's `images` array. Set the three Cloudinary environment variables above to enable uploads.

`CLOUDINARY_UPLOAD_TIMEOUT_MS` controls the maximum time allowed for each image upload. It defaults to `120000` milliseconds (2 minutes); increase it if your network is slow. Restart the server after changing `.env`.

## Roles and first admin

Public signup always creates a `USER`; it ignores a supplied `role`. There is no public admin signup. To bootstrap the first admin locally, create a user through signup and promote that account from a trusted MongoDB shell:

```javascript
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "ADMIN" } }
)
```

Never expose this database update operation to public clients. Existing records with legacy `customer` or `salesperson` roles are treated as `USER`, and legacy `admin` accounts are treated as `ADMIN` during login and authorization. New tokens use the uppercase roles.

## Routes and flows

### `GET /api/health`

No authentication. Returns `200` when the API process is responding.

### `POST /api/users/signup`

Creates a user account, hashes the password, and assigns `USER`. It does not log the new account in.

```json
{
  "username": "Ravi",
  "email": "ravi@example.com",
  "phone_number": "+15550000001",
  "password": "ExamplePass123!"
}
```

Returns `201` with the public user profile. Missing fields return `400`; duplicate email returns `409`.

### `POST /api/users/login`

Signs in a `USER` with email and password. On success, returns an access token and sets the refresh cookie. Admin accounts must use the admin login route.

```json
{
  "email": "ravi@example.com",
  "password": "ExamplePass123!"
}
```

Wrong credentials or a non-user role returns `401`.

### `POST /api/users/admin/login`

Signs in an `ADMIN` using the same email/password body. It returns an admin access token and sets the refresh cookie. The initial admin is bootstrapped through the trusted database process above. Wrong credentials or a non-admin role returns `401`.

### `GET /api/users/me`

Returns the current user's public profile. Requires `Authorization: Bearer <accessToken>` from user login. Missing credentials return `401`; invalid/expired tokens or a non-user role return `403`.

### `GET /api/admin/me`

Returns the current admin's public profile. Requires an admin bearer token. User tokens are rejected with `403`.

### `POST /api/users/refresh`

Exchanges the refresh cookie for a new access token and rotates the refresh cookie. Send the cookie from login; in Postman it is normally sent automatically. Missing, expired, or reused refresh tokens return `401` and clear the cookie.

### `POST /api/users/logout`

Revokes the stored refresh session and clears the cookie. It returns `200` even if the cookie is already missing or expired. An access token that was already issued remains valid until its expiry.

### `POST /api/admin/products`

Creates a product. Requires an admin bearer token. The API derives `createdBy` from the verified token; clients cannot choose the creator or set `isActive`. For products with images, select **Body → form-data** in Postman. Add `name`, `description`, `price`, `category`, `sku`, and optional `stock` as text fields. Add each image as a **File** field named `images`. Up to 8 JPEG, PNG, or WebP images are accepted, with a 5 MB limit per file. Images are uploaded to Cloudinary and their secure URLs are stored in the product's `images` array.

`name`, `description`, `price`, `category`, and `sku` are required. `stock` defaults to `0`; images default to an empty array. A successful create returns `201`. Invalid data returns `400`, a duplicate SKU returns `409`, missing Cloudinary credentials returns `503` when uploading files, Cloudinary timeouts return `504`, and interrupted Cloudinary connections return `502` with a network troubleshooting message.

### `PATCH /api/admin/products/:productId`

Partially updates an existing product. Requires an admin bearer token. JSON can update one or more of `name`, `description`, `price`, `category`, `sku`, and `stock`. To replace product images, use multipart form-data and upload one or more files with the key `images`; the new Cloudinary URLs replace the product's current `images` array. The request rejects unknown fields, including `createdBy` and `isActive`. It returns `200` with the updated product, `400` for an invalid ID/body, `404` if no product exists, and `409` if the new SKU is already in use.

Example body:

```json
{
  "price": 17.99,
  "stock": 30
}
```

When replacing images, use **Body → form-data** instead and add file entries with the key `images`. Previous Cloudinary assets are not deleted automatically when references are replaced.

### `GET /api/products`

Publicly lists active products, newest first. Supports `search`, `category`, `page`, and `limit` query parameters. Defaults are `page=1` and `limit=20`; maximum limit is `100`.

Example: `GET /api/products?search=mug&category=Kitchen&page=1&limit=10`

Response includes `items`, `total`, `page`, `limit`, and `pages`. Invalid pagination returns `400`.

### `GET /api/products/:productId`

Publicly returns one active product. Invalid ID returns `400`; missing or inactive product returns `404`.

## Cart and orders

Cart and customer order routes require a `USER` access token in `Authorization: Bearer <accessToken>`. The backend gets the cart owner from that token. Product prices and order totals are always read and calculated by the server; clients only submit product IDs, quantities, and delivery details. Checkout currently supports cash on delivery (`COD`) and sets the order status to `PENDING`. It atomically decrements inventory, creates the order, and empties the cart in one MongoDB transaction.

### `GET /api/cart`

Returns the signed-in user's cart. Each item includes the current product details, quantity, and a calculated line total. An empty cart returns an empty `items` array.

### `POST /api/cart/items`

Adds a product to the user's cart. If that product is already present, the requested quantity is added to its existing quantity. The product must be active and the resulting cart quantity cannot exceed available stock.

```json
{
  "productId": "PRODUCT_ID_FROM_GET_PRODUCTS",
  "quantity": 2
}
```

Returns `200` and the updated cart. Invalid IDs or quantities return `400`; unavailable products return `404`; insufficient stock returns `409`.

### `PATCH /api/cart/items/:productId`

Sets the quantity for a product already in the cart. Send `{ "quantity": 3 }`. It checks the product is active and the requested quantity is in stock. Returns `404` if the product is not in the cart and `409` if stock is insufficient.

### `DELETE /api/cart/items/:productId`

Removes one product from the signed-in user's cart. It does not affect another user's cart.

### `DELETE /api/cart`

Empties the signed-in user's cart.

### `POST /api/orders`

Checks out the signed-in user's cart. The server rechecks that products are active and in stock, reserves stock, calculates prices and totals, saves an order snapshot, then clears the cart. The order preserves each product's name, SKU, image, unit price, and quantity at purchase time, even if the catalog changes later. No card payment is processed by this first version.

```json
{
  "paymentMethod": "COD",
  "shippingAddress": {
    "recipientName": "Ravi Kumar",
    "phone": "+15550000001",
    "addressLine1": "12 Market Street",
    "addressLine2": "Apartment 4B",
    "city": "Chennai",
    "state": "Tamil Nadu",
    "postalCode": "600001",
    "country": "India"
  }
}
```

Requires an `Idempotency-Key` request header (8–128 letters, numbers, dots, underscores, colons, or hyphens), for example `checkout-ravi-20261018-01`. Keep the same key when retrying the same checkout after a timeout. The first successful request returns `201`; a retry with that key returns `200` and the original order without decrementing stock a second time. Use a new key for a genuinely new order. An empty cart or invalid address returns `400`; a product that became unavailable or ran out of stock returns `409`. The checkout does not accept item prices or totals from the client.

Checkout performs the stock updates, order creation, and cart clearing in one MongoDB transaction. MongoDB must run as a replica set or sharded cluster for this route; standalone local MongoDB does not support transactions. MongoDB Atlas supports them. For local development, configure a replica set and include its name in the URI, for example `mongodb://127.0.0.1:27017/ecommerce?replicaSet=rs0`. If MongoDB is not configured for transactions, checkout returns `503` with a setup message.

### `GET /api/orders` and `GET /api/orders/:orderId`

Lists the signed-in user's orders with optional `page` and `limit` query parameters, or returns one of that user's orders. A customer cannot read another user's order; that request returns `404`.

### `GET /api/admin/orders`

Lists orders for an admin. Supports `page`, `limit`, and a `status` filter, such as `/api/admin/orders?status=PENDING`. Requires an `ADMIN` access token.

### `PATCH /api/admin/orders/:orderId/status`

Moves an order forward one step. Requires an `ADMIN` access token and a JSON body such as `{ "status": "CONFIRMED" }`. Allowed transitions are `PENDING` → `CONFIRMED` → `PROCESSING` → `SHIPPED` → `DELIVERED`. Admins may cancel orders while `PENDING` or `CONFIRMED`; cancellation restores the ordered quantities to inventory. Invalid transitions return `400`.

### Postman order flow

1. Log in as a `USER` and use that access token for cart and order requests.
2. Get a product ID from `GET /api/products` and add it with `POST /api/cart/items`.
3. Check the cart with `GET /api/cart`; adjust or remove items if needed.
4. Send `POST /api/orders` with the delivery address above. Save the returned order ID.
5. Check the order with `GET /api/orders/:orderId`. As an admin, list it with `GET /api/admin/orders` and advance its status using `PATCH /api/admin/orders/:orderId/status`.

## Postman quick check

1. Sign up a normal user, then sign in with `POST /api/users/login`.
2. Verify `GET /api/products` works without a token and `GET /api/users/me` works with the user access token.
3. Bootstrap an admin account using the MongoDB command above, then sign in with `POST /api/users/admin/login`.
4. Configure Cloudinary credentials, then call `POST /api/admin/products` with the admin bearer token and form-data fields; attach an image with a File field named `images`.
5. Confirm the response's `product.images` contains Cloudinary secure URLs. Repeat product creation without a token and with the user token; both should be rejected. Use `GET /api/products` to confirm the product and its image URL are public.

## Next marketplace phase

The Seller schema in `src/modules/sellers/seller.model.js` is not yet used by the current routes. Seller applications, secure document uploads, verification review, and seller-owned product management will be added after this basic user/admin flow is tested. Product categories are plain text in this first stage; a Category collection can be added separately if needed.

## Product availability, live updates, and inventory safety

### Admin stock and status routes

Both routes require an `ADMIN` access token:

- `PATCH /api/admin/products/:productId/stock` with `{ "stock": 25 }` sets stock to a non-negative whole number. This is for admin corrections; checkout itself uses a conditional decrement.
- `PATCH /api/admin/products/:productId/status` with `{ "status": "INACTIVE" }` hides a product from public APIs. Send `ACTIVE` to make it public again. A product with stock zero stays active and visible, but checkout rejects it until it is restocked.

Products now have a numeric `version`, initially `1`, incremented whenever product details or inventory are changed. A frontend can use this number to ignore stale updates.

### Socket.IO product events

The backend runs Socket.IO on the same HTTP server as Express. A connection must pass the same valid access JWT in the Socket.IO `auth` object as used by HTTP bearer authentication. A socket can subscribe to up to 20 active public products:

```javascript
socket.emit("product:subscribe", { productId }, (ack) => console.log(ack));
socket.emit("product:unsubscribe", { productId });
```

Subscriptions are acknowledged with the current product version. On subsequent changes, subscribers receive one of:

- `product:updated` with `{ productId, version, changes }` containing safe public fields.
- `product:unavailable` with `{ productId, version, reason, status }` when deactivated or sold out. `reason` is `INACTIVE` or `OUT_OF_STOCK`; for out-of-stock products, `status` remains `ACTIVE`.

Events are emitted only after the relevant database update or transaction commits. Socket delivery is best-effort: a disconnected client can miss events, so fetch the product again on every reconnection. The React example hook is in [docs/react-product-live-updates.example.jsx](docs/react-product-live-updates.example.jsx); install `socket.io-client` in the frontend package because this repository only contains the backend. The example removes listeners and disconnects during component cleanup.

This instance uses in-memory rooms, which work for a single backend process. Multiple backend instances need a Socket.IO adapter such as Redis to share room membership and broadcasts. If events must survive backend crashes between a database commit and socket emission, add a transactional outbox and background publisher; Socket.IO does not persist events.

### Preventing overselling

A read-then-save stock check is unsafe: two checkout requests can both read `stock: 1`, then both conclude they can sell the last item. Checkout instead decrements stock using an atomic conditional update: the database matches the product only while it is active and has at least the requested quantity, then subtracts that quantity with `$inc`. If a competing order already bought the last unit, the filter matches no document and checkout returns `409`. The quantity is checked as a positive whole number before it can enter the cart, and stock is checked again during checkout.

The transaction applies that conditional decrement for every cart item, inserts the order snapshot, and clears the cart. If any item is unavailable, throwing an error aborts the transaction and rolls back all earlier decrements. This prevents a partial checkout. Each product document update is atomic by itself; the checkout transaction is needed because the operation spans multiple products, an order document, and the cart.

Stock is not reserved when a customer adds an item to the cart. It is deducted at checkout. This version has no reservation-expiry worker; pending COD orders keep stock deducted until fulfilled or cancelled. Customer cancellation is `POST /api/orders/:orderId/cancel`, and admins can set `CANCELLED` with `PATCH /api/admin/orders/:orderId/status` while the order is `PENDING` or `CONFIRMED`. In both cases, changing the order and restoring the line-item quantities are one transaction; the state transition prevents duplicate restoration. A future payment-reservation flow should record reservation state and expiry, then atomically expire each still-active reservation and restore its quantity once.

### Transaction basics in this project

ACID means atomicity (all writes commit or none do), consistency (rules remain valid), isolation (concurrent changes cannot silently interleave as if they were sequential), and durability (committed writes persist). MongoDB writes to one document are atomic without a transaction; a session and transaction boundary are useful when several documents must succeed or fail together. `session.withTransaction()` commits its callback on success and aborts on errors; MongoDB's driver can retry callbacks after transient errors, so the callback contains only retry-safe database operations. Socket events are emitted after the transaction, never inside it, and external network calls should also stay outside.

Transactions add coordination overhead, so this code uses one for multi-document checkout and cancellation, but not for a single product edit. MongoDB must be configured as a replica set or sharded cluster. For local development, put a replica-set URI in `MONGO_URI`, for example `mongodb://127.0.0.1:27017/ecommerce?replicaSet=rs0`; MongoDB Atlas also supports transactions. A standalone local server will cause checkout or cancellation to return `503`.

### Automated transaction checks

Run `npm test`. `test/checkout.transaction.test.js` covers commit, rollback when a cart contains an unavailable item, retrying with the same idempotency key, one-time cancellation restoration, and two customers trying to buy the final unit concurrently. Set `TEST_MONGODB_URI` to a dedicated replica-set test database to run these integration tests; without it, Node reports them as skipped. Use a separate test database so test cleanup cannot touch development data.

### Postman checks for the added routes

1. Sign in with `POST /api/users/admin/login`. Set the returned access token as the Bearer token in Postman.
2. Set inventory with `PATCH /api/admin/products/:productId/stock` and JSON `{ "stock": 3 }`. Confirm the response shows `stock: 3` and a higher `version`. Try `-1` or `1.5`; both should return `400`.
3. Deactivate using `PATCH /api/admin/products/:productId/status` and `{ "status": "INACTIVE" }`. Confirm `GET /api/products/:productId` returns `404`; activate it again with `{ "status": "ACTIVE" }`.
4. Sign in as a user, add the product with `POST /api/cart/items`, then place an order with `POST /api/orders`. Add `Idempotency-Key: checkout-postman-001` under Headers. Keep the same body and key for a retry; the retry should return `200` with the same order ID. A second order should use a different key.
5. Cancel that pending order with `POST /api/orders/:orderId/cancel`. Check the active product with `GET /api/products/:productId`; its prior quantity should be restored. Repeating cancellation should return `409` and must not add stock again.
6. Try the admin routes without a token and with a user token; they should return `401` and `403`, respectively. Try cancelling another user's order; it should return `404`.

Socket.IO is an event protocol rather than an HTTP route. To check those messages, connect with a Socket.IO client using an access token, subscribe with `product:subscribe`, then update the product's stock or status with one of the admin routes. The authenticated subscriber should receive the corresponding product event. Postman versions with Socket.IO support can run the same handshake and event flow; otherwise use the example React hook or a small `socket.io-client` script.

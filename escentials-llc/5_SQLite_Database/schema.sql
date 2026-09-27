-- Escentials LLC: the transaction database behind the financial statements.
-- The generator fills it with illustrative rows, for privacy: modeled on the business, not its actual results.
-- Real eBay and Shopify exports would load into the same tables without changing any query downstream.
PRAGMA foreign_keys = ON;

CREATE TABLE metadata (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
);

CREATE TABLE products (
    sku           TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    product_line  TEXT NOT NULL CHECK (product_line IN ('Designer fragrance', 'Car Perfume', 'Refills')),
    list_price    REAL NOT NULL,
    unit_cost     REAL NOT NULL
);

CREATE TABLE customers (
    customer_id          TEXT PRIMARY KEY,
    first_order_date     TEXT NOT NULL,
    acquisition_channel  TEXT NOT NULL CHECK (acquisition_channel IN ('eBay', 'Shopify')),
    state                TEXT NOT NULL,
    email_opt_in         INTEGER NOT NULL DEFAULT 0      -- Shopify checkout opt in; eBay shares no email
);

CREATE TABLE orders (
    order_id          TEXT PRIMARY KEY,
    order_date        TEXT NOT NULL,                 -- ISO date the order shipped
    channel           TEXT NOT NULL CHECK (channel IN ('eBay', 'Shopify')),
    ship_state        TEXT NOT NULL,
    shipping_charged  REAL NOT NULL DEFAULT 0,       -- paid by the customer: revenue
    discount          REAL NOT NULL DEFAULT 0,       -- order level discount: contra revenue
    tax_collected     REAL NOT NULL DEFAULT 0,       -- Shopify orders shipped in California; eBay remits its own
    marketplace_fee   REAL NOT NULL DEFAULT 0,       -- eBay final value and per order fees
    payment_fee       REAL NOT NULL DEFAULT 0,       -- Shopify Payments processing
    ad_fee            REAL NOT NULL DEFAULT 0,       -- eBay promoted listings, charged when the item sells
    fulfillment_cost  REAL NOT NULL DEFAULT 0,       -- supplier drop ship fee, or our postage label
    packaging_cost    REAL NOT NULL DEFAULT 0,
    customer_id       TEXT NOT NULL REFERENCES customers (customer_id)
);

CREATE TABLE order_lines (
    order_id    TEXT NOT NULL REFERENCES orders (order_id),
    line_no     INTEGER NOT NULL,
    sku         TEXT NOT NULL REFERENCES products (sku),
    qty         INTEGER NOT NULL CHECK (qty > 0),
    unit_price  REAL NOT NULL,
    unit_cost   REAL NOT NULL,
    PRIMARY KEY (order_id, line_no)
);

CREATE TABLE refunds (
    refund_id           TEXT PRIMARY KEY,
    order_id            TEXT NOT NULL REFERENCES orders (order_id),
    refund_date         TEXT NOT NULL,
    sku                 TEXT NOT NULL REFERENCES products (sku),
    qty                 INTEGER NOT NULL,
    merchandise_refund  REAL NOT NULL,
    cost_returned       REAL NOT NULL                -- back in stock, or credited by the supplier
);

CREATE TABLE interactions (                          -- customer service touchpoints, for the CRM
    interaction_id  INTEGER PRIMARY KEY,
    customer_id     TEXT NOT NULL REFERENCES customers (customer_id),
    order_id        TEXT REFERENCES orders (order_id),
    opened          TEXT NOT NULL,
    closed          TEXT NOT NULL,
    channel         TEXT NOT NULL,                   -- eBay messages or email
    topic           TEXT NOT NULL,                   -- return request, shipping status, scent question, order change
    outcome         TEXT NOT NULL
);

CREATE TABLE expenses (
    expense_id    INTEGER PRIMARY KEY,
    expense_date  TEXT NOT NULL,
    vendor        TEXT NOT NULL,
    category      TEXT NOT NULL,
    amount        REAL NOT NULL
);

CREATE TABLE inventory_purchases (
    purchase_id    INTEGER PRIMARY KEY,
    purchase_date  TEXT NOT NULL,
    description    TEXT NOT NULL,
    amount         REAL NOT NULL
);

CREATE TABLE fixed_asset_purchases (
    asset_id       INTEGER PRIMARY KEY,
    purchase_date  TEXT NOT NULL,
    description    TEXT NOT NULL,
    amount         REAL NOT NULL
);

CREATE TABLE owner_transactions (
    txn_id    INTEGER PRIMARY KEY,
    txn_date  TEXT NOT NULL,
    txn_type  TEXT NOT NULL CHECK (txn_type IN ('contribution', 'distribution')),
    amount    REAL NOT NULL
);

CREATE TABLE sales_tax_remittances (
    remittance_id  INTEGER PRIMARY KEY,
    paid_date      TEXT NOT NULL,
    period         TEXT NOT NULL,
    amount         REAL NOT NULL
);

-- Balances carried in from the prior year's close (January 1 of the fiscal year).
CREATE TABLE opening_balances (
    account  TEXT PRIMARY KEY,
    amount   REAL NOT NULL
);

CREATE INDEX idx_orders_date ON orders (order_date);
CREATE INDEX idx_lines_sku ON order_lines (sku);
CREATE INDEX idx_refunds_date ON refunds (refund_date);
CREATE INDEX idx_orders_customer ON orders (customer_id);

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, describe, test } from "node:test";
import mongoose from "mongoose";
import Cart from "../src/modules/cart/cart.model.js";
import Order from "../src/modules/orders/order.model.js";
import { cancelOrderForUser, CheckoutError, checkoutFromCart } from "../src/modules/orders/order.service.js";
import Product from "../src/modules/products/products.modal.js";
import "dotenv/config";

const testMongoUri = process.env.TEST_MONGODB_URI;
const createdUserIds = [];
const createdProductIds = [];

describe("checkout transaction integration", { skip: !testMongoUri && "Set TEST_MONGODB_URI to a dedicated replica-set database." }, () => {
    before(async () => {
        await mongoose.connect(testMongoUri);
        await Promise.all([Cart.init(), Order.init(), Product.init()]);
    });

    afterEach(async () => {
        if (createdUserIds.length) {
            await Promise.all([
                Cart.deleteMany({ user: { $in: createdUserIds } }),
                Order.deleteMany({ user: { $in: createdUserIds } })
            ]);
            createdUserIds.length = 0;
        }
        if (createdProductIds.length) {
            await Product.deleteMany({ _id: { $in: createdProductIds } });
            createdProductIds.length = 0;
        }
    });

    after(async () => {
        await mongoose.disconnect();
    });

    const createProduct = async (userId, stock) => {
        const product = await Product.create({
            name: `Test item ${randomUUID().slice(0, 8)}`,
            description: "Automated checkout test item",
            price: 10,
            category: "Test",
            sku: `TEST-${randomUUID()}`,
            stock,
            createdBy: userId
        });
        createdProductIds.push(product._id);
        return product;
    };

    const createUserCart = async (items) => {
        const userId = new mongoose.Types.ObjectId();
        createdUserIds.push(userId);
        const products = [];
        for (const item of items) products.push(await createProduct(userId, item.stock));
        await Cart.create({
            user: userId,
            items: products.map((product, index) => ({ product: product._id, quantity: items[index].quantity }))
        });
        return { userId, products };
    };

    const address = {
        recipientName: "Test Customer",
        phone: "1234567890",
        addressLine1: "1 Test Street",
        city: "Test City",
        state: "Test State",
        postalCode: "12345",
        country: "Test Country"
    };

    test("commits stock changes, order creation, and cart clearing together", async () => {
        const { userId, products } = await createUserCart([{ stock: 5, quantity: 2 }]);
        const result = await checkoutFromCart(userId, address, randomUUID());

        assert.equal(result.order.items.length, 1);
        assert.equal(result.order.total, 20);
        assert.equal(result.replayed, false);
        assert.equal((await Product.findById(products[0]._id)).stock, 3);
        assert.equal((await Cart.findOne({ user: userId })).items.length, 0);
    });

    test("rolls all stock back and keeps the cart when any item is unavailable", async () => {
        const { userId, products } = await createUserCart([
            { stock: 5, quantity: 2 },
            { stock: 0, quantity: 1 }
        ]);
        const key = randomUUID();

        await assert.rejects(
            checkoutFromCart(userId, address, key),
            (error) => error instanceof CheckoutError && error.status === 409
        );
        assert.equal((await Product.findById(products[0]._id)).stock, 5);
        assert.equal((await Order.countDocuments({ user: userId, idempotencyKey: key })), 0);
        assert.equal((await Cart.findOne({ user: userId })).items.length, 2);
    });

    test("returns the existing order for a repeated idempotency key without decrementing stock twice", async () => {
        const { userId, products } = await createUserCart([{ stock: 5, quantity: 2 }]);
        const key = randomUUID();
        const first = await checkoutFromCart(userId, address, key);
        const retry = await checkoutFromCart(userId, address, key);

        assert.equal(retry.replayed, true);
        assert.equal(retry.order._id.toString(), first.order._id.toString());
        assert.equal((await Product.findById(products[0]._id)).stock, 3);
        assert.equal(await Order.countDocuments({ user: userId }), 1);
    });

    test("restores stock on cancellation and does not restore it twice", async () => {
        const { userId, products } = await createUserCart([{ stock: 4, quantity: 2 }]);
        const result = await checkoutFromCart(userId, address, randomUUID());
        const cancelled = await cancelOrderForUser(result.order._id, userId);

        assert.equal(cancelled.status, "CANCELLED");
        assert.equal((await Product.findById(products[0]._id)).stock, 4);
        await assert.rejects(cancelOrderForUser(result.order._id, userId), CheckoutError);
        assert.equal((await Product.findById(products[0]._id)).stock, 4);
    });

    test("allows only one simultaneous checkout to buy the final unit", async () => {
        const productOwner = new mongoose.Types.ObjectId();
        const product = await createProduct(productOwner, 1);
        const firstUser = new mongoose.Types.ObjectId();
        const secondUser = new mongoose.Types.ObjectId();
        createdUserIds.push(firstUser, secondUser);
        await Cart.create({ user: firstUser, items: [{ product: product._id, quantity: 1 }] });
        await Cart.create({ user: secondUser, items: [{ product: product._id, quantity: 1 }] });

        const results = await Promise.allSettled([
            checkoutFromCart(firstUser, address, randomUUID()),
            checkoutFromCart(secondUser, address, randomUUID())
        ]);

        assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
        assert.equal((await Product.findById(product._id)).stock, 0);
        assert.equal(await Order.countDocuments({ "items.product": product._id }), 1);
    });
});

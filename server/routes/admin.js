const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/stats -> métricas do painel
router.get('/stats', (_req, res) => {
  const paidWhere = "payment_status = 'paid' AND status != 'cancelled'";
  const revenue = db.prepare(`SELECT COALESCE(SUM(total),0) v FROM orders WHERE ${paidWhere}`).get().v;
  const ordersCount = db.prepare('SELECT COUNT(*) n FROM orders').get().n;
  const pendingPix = db.prepare("SELECT COUNT(*) n FROM orders WHERE payment_status = 'pending'").get().n;
  const productsCount = db.prepare('SELECT COUNT(*) n FROM products WHERE active = 1').get().n;
  const lowStock = db.prepare('SELECT id, name, stock, unit FROM products WHERE active = 1 AND stock <= 5 ORDER BY stock ASC').all();
  const customers = db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'customer'").get().n;
  const co2 = db.prepare(`
    SELECT COALESCE(SUM(oi.quantity * p.co2),0) v FROM order_items oi
    JOIN products p ON p.id = oi.product_id JOIN orders o ON o.id = oi.order_id WHERE o.${paidWhere}
  `).get().v;

  const recentOrders = db.prepare(`
    SELECT o.id, o.code, o.total, o.status, o.payment_method, o.payment_status, o.created_at, u.name AS customer_name
    FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 8
  `).all();

  const topProducts = db.prepare(`
    SELECT p.id, p.name, p.image, p.unit, SUM(oi.quantity) qty, SUM(oi.quantity*oi.price) revenue
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id WHERE o.status != 'cancelled'
    GROUP BY p.id ORDER BY qty DESC LIMIT 5
  `).all();

  const salesByDay = db.prepare(`
    SELECT substr(created_at,1,10) day, COALESCE(SUM(total),0) total, COUNT(*) orders
    FROM orders WHERE ${paidWhere} AND created_at >= datetime('now','-7 days')
    GROUP BY day ORDER BY day
  `).all();

  res.json({
    revenue, ordersCount, pendingPix, productsCount, customers,
    co2: Math.round(co2 * 10) / 10,
    lowStock, recentOrders, topProducts, salesByDay
  });
});

// GET /api/admin/users
router.get('/users', (_req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.mbv_balance, u.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count,
      (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id = u.id AND o.payment_status='paid' AND o.status!='cancelled') AS spent
    FROM users u ORDER BY u.id DESC
  `).all();
  res.json({ users });
});

module.exports = router;

var express = require('express');
var router = express.Router();
let slugify = require('slugify');
let productModel = require('../schemas/products');
let Inventory = require('../schemas/inventory');
const Product = require('../schemas/products');

// ================= INVENTORY ROUTES (Đặt lên đầu) =================
// Lấy tất cả inventory, join product
router.get('/inventory', async (req, res) => {
    try {
        const inventories = await Inventory.find().populate('product');
        res.json(inventories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Lấy inventory theo id, join product
router.get('/inventory/:id', async (req, res) => {
    try {
        const inventory = await Inventory.findById(req.params.id).populate('product');
        if (!inventory) return res.status(404).json({ error: 'Inventory not found' });
        res.json(inventory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Tăng stock
router.post('/inventory/add_stock', async (req, res) => {
    const { product, quantity } = req.body;
    if (!product || typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ error: 'Invalid product or quantity' });
    }
    try {
        const inventory = await Inventory.findOneAndUpdate(
            { product },
            { $inc: { stock: quantity } },
            { new: true }
        );
        if (!inventory) return res.status(404).json({ error: 'Inventory not found' });
        res.json(inventory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Giảm stock
router.post('/inventory/remove_stock', async (req, res) => {
    const { product, quantity } = req.body;
    if (!product || typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ error: 'Invalid product or quantity' });
    }
    try {
        const inventory = await Inventory.findOne({ product });
        if (!inventory) return res.status(404).json({ error: 'Inventory not found' });
        if (inventory.stock < quantity) {
            return res.status(400).json({ error: 'Not enough stock' });
        }
        inventory.stock -= quantity;
        await inventory.save();
        res.json(inventory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Đặt hàng: giảm stock, tăng reserved
router.post('/inventory/reservation', async (req, res) => {
    const { product, quantity } = req.body;
    if (!product || typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ error: 'Invalid product or quantity' });
    }
    try {
        const inventory = await Inventory.findOne({ product });
        if (!inventory) return res.status(404).json({ error: 'Inventory not found' });
        if (inventory.stock < quantity) {
            return res.status(400).json({ error: 'Not enough stock' });
        }
        inventory.stock -= quantity;
        inventory.reserved += quantity;
        await inventory.save();
        res.json(inventory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bán hàng: giảm reserved, tăng soldCount
router.post('/inventory/sold', async (req, res) => {
    const { product, quantity } = req.body;
    if (!product || typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ error: 'Invalid product or quantity' });
    }
    try {
        const inventory = await Inventory.findOne({ product });
        if (!inventory) return res.status(404).json({ error: 'Inventory not found' });
        if (inventory.reserved < quantity) {
            return res.status(400).json({ error: 'Not enough reserved stock' });
        }
        inventory.reserved -= quantity;
        inventory.soldCount += quantity;
        await inventory.save();
        res.json(inventory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ================= END INVENTORY ROUTES =================

/* GET users listing. */
router.get('/', async function (req, res, next) {
    let queries = req.query;
    let titleQ = queries.title ? queries.title.toLowerCase() :'';
    let max = queries.max ? queries.max : 10000;
    let min = queries.min ? queries.min : 0;
    let data = await productModel.find({
        isDeleted: false,
        title: new RegExp(titleQ,'i'),
        price: {
            $gte: min,
            $lte: max
        }
    }).populate({
        path: 'category',
        select: 'name'
    });
    res.send(data);
});

router.post('/', async function (req, res) {
    let newProduct = new productModel({
        title: req.body.title,
        slug: slugify(req.body.title, {
            replacement: '-',
            remove: undefined,
            lower: true,
            strict: true
        }),
        price: req.body.price,
        description: req.body.description,
        category: req.body.category,
        images: req.body.images
    })
    await newProduct.save()
    // Create corresponding inventory
    await Inventory.create({
        product: newProduct._id,
        stock: 0,
        reserved: 0,
        soldCount: 0
    })
    res.send(newProduct)
})

router.put('/:id', async function (req, res) {
    try {
        let id = req.params.id;
        let result = await productModel.findByIdAndUpdate(
            id, req.body, {
            new: true
        })
        res.send(result)
    } catch (error) {
        res.status(404).send({
            message: error.message
        })
    }
})

router.delete('/:id', async function (req, res) {
    try {
        let id = req.params.id;
        let result = await productModel.findOne({
            isDeleted: false,
            _id: id
        });
        if (result) {
            result.isDeleted = true
            await result.save();
            res.send(result)
        } else {
            res.status(404).send({
                message: "ID NOT FOUND"
            })
        }
    } catch (error) {
        res.status(404).send({
            message: error.message
        })
    }
})

router.get('/:id', async function (req, res, next) {
    try {
        let id = req.params.id;
        let result = await productModel.find({
            isDeleted: false,
            _id: id
        });
        if (result.length) {
            res.send(result[0])
        } else {
            res.status(404).send({
                message: "ID NOT FOUND"
            })
        }
    } catch (error) {
        res.status(404).send({
            message: error.message
        })
    }
});

module.exports = router;

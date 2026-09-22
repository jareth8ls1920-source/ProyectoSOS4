const express = require('express');
const router = express.Router();
const tokenController = require('../controllers/token');

// Link que llega en el email de bienvenida
router.get('/confirmation/:token', tokenController.confirmationGet);

module.exports = router;

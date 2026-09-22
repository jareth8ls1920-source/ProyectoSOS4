const mongoose = require('mongoose');

/**
 * Plugin sencillo de validación de unicidad para Mongoose.
 * Antes de guardar, verifica que no exista otro documento con el mismo valor
 * en cada campo marcado como `unique` y, si existe, lanza un ValidationError
 * con un mensaje legible (en lugar del error E11000 crudo de MongoDB).
 */
module.exports = function uniqueValidator(schema, options) {
  const message = (options && options.message) || 'Error, expected {PATH} to be unique.';

  const uniquePaths = [];
  schema.eachPath(function (path, schemaType) {
    if (schemaType.options && schemaType.options.unique) {
      uniquePaths.push(path);
    }
  });

  schema.pre('save', async function () {
    const doc = this;
    const Model = doc.constructor;

    for (const path of uniquePaths) {
      const value = doc.get(path);
      if (value === undefined || value === null) continue;

      const query = { [path]: value, _id: { $ne: doc._id } };
      const exists = await Model.exists(query);
      if (exists) {
        const err = new mongoose.Error.ValidationError(doc);
        err.addError(path, new mongoose.Error.ValidatorError({
          path: path,
          value: value,
          message: message.replace('{PATH}', path).replace('{VALUE}', value),
          type: 'unique',
        }));
        throw err;
      }
    }
  });
};

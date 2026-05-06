'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Vacunacion extends Model {
    /**
     * Devuelve true si el paciente tiene pendiente una próxima dosis.
     */
    tieneDosisPendiente(fecha = new Date()) {
      if (!this.proxima_dosis) return false;
      return new Date(this.proxima_dosis) >= fecha;
    }

    /**
     * Devuelve true si la próxima dosis está vencida (ya pasó la fecha).
     */
    dosisPendienteVencida(fecha = new Date()) {
      if (!this.proxima_dosis) return false;
      return new Date(this.proxima_dosis) < fecha;
    }

    static associate(models) {
      // Vacunacion pertenece a un Paciente
      Vacunacion.belongsTo(models.Paciente, {
        foreignKey: 'paciente_id',
        as: 'paciente',
      });

      // Vacunacion fue registrada por un Usuario (enfermería / médico)
      Vacunacion.belongsTo(models.User, {
        foreignKey: 'registrado_por_id',
        as: 'registradoPor',
      });
    }
  }

  Vacunacion.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      paciente_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'pacientes', key: 'id' },
        onDelete: 'RESTRICT',
      },

      vacuna: {
        type: DataTypes.STRING(150),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'El nombre de la vacuna no puede estar vacío.' },
          len: { args: [1, 150], msg: 'El nombre de la vacuna no puede superar los 150 caracteres.' },
        },
      },

      dosis_numero: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: { args: [1], msg: 'El número de dosis debe ser al menos 1.' },
          max: { args: [99], msg: 'El número de dosis no puede superar 99.' },
          isInt: { msg: 'El número de dosis debe ser un entero.' },
        },
      },

      lote: {
        type: DataTypes.STRING(80),
        allowNull: true,            // número de lote del vial
      },

      laboratorio: {
        type: DataTypes.STRING(100),
        allowNull: true,            // ej: "Pfizer", "Sinopharm", "Sanofi"
      },

      fecha_aplicacion: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: { msg: 'La fecha de aplicación debe ser una fecha válida.' },
          noEsFutura(value) {
            if (value && new Date(value) > new Date()) {
              throw new Error('La fecha de aplicación no puede ser futura.');
            }
          },
        },
      },

      proxima_dosis: {
        type: DataTypes.DATEONLY,
        allowNull: true,            // NULL = esquema completo / dosis única
        validate: {
          isDate: { msg: 'La fecha de próxima dosis debe ser una fecha válida.' },
          esDespuesDeAplicacion(value) {
            if (value && this.fecha_aplicacion && new Date(value) <= new Date(this.fecha_aplicacion)) {
              throw new Error('La próxima dosis debe ser posterior a la fecha de aplicación.');
            }
          },
        },
      },

      registrado_por_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'RESTRICT',
      },

      observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,            // reacciones adversas, sitio de aplicación, etc.
      },
    },
    {
      sequelize,
      modelName: 'Vacunacion',
      tableName: 'vacunaciones',
      underscored: true,
      timestamps: true,
      createdAt: 'creado_en',
      updatedAt: false,

      scopes: {
        /** Vacunas con próxima dosis pendiente (fecha futura) */
        conDosisPendiente: {
          where: sequelize.literal(`proxima_dosis >= CURRENT_DATE`),
        },

        /** Vacunas con próxima dosis vencida (fecha pasada) */
        vencidas: {
          where: sequelize.literal(`proxima_dosis < CURRENT_DATE`),
        },

        /** Incluye paciente y quien registró en la consulta */
        completa: (models) => ({
          include: [
            {
              model: models.Paciente,
              as: 'paciente',
              attributes: ['id', 'nombre', 'apellido', 'dni'],
            },
            {
              model: models.User,
              as: 'registradoPor',
              attributes: ['id', 'nombre_completo', 'rol'],
            },
          ],
        }),
      },
    }
  );

  return Vacunacion;
};

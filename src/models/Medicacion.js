'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Medicacion extends Model {
    /**
     * Devuelve true si la medicación sigue vigente a la fecha dada (default: hoy).
     */
    estaVigente(fecha = new Date()) {
      if (!this.activo) return false;
      if (!this.fin) return true;                     // crónico / sin fecha de fin
      return new Date(this.fin) >= fecha;
    }

    static associate(models) {
      // Medicacion pertenece a un Paciente
      Medicacion.belongsTo(models.Paciente, {
        foreignKey: 'paciente_id',
        as: 'paciente',
      });

      // Medicacion fue prescripta por un Usuario (médico)
      Medicacion.belongsTo(models.User, {
        foreignKey: 'prescripto_por_id',
        as: 'prescriptoPor',
      });
    }
  }

  Medicacion.init(
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

      farmaco: {
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'El nombre del fármaco no puede estar vacío.' },
          len: { args: [1, 200], msg: 'El fármaco no puede superar los 200 caracteres.' },
        },
      },

      dosis: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'La dosis es requerida. Ej: "10 mg".' },
        },
      },

      frecuencia: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'La frecuencia es requerida. Ej: "cada 8 hs".' },
        },
      },

      via: {
        type: DataTypes.STRING(50),
        allowNull: true,              // ej: "oral", "IV", "SC", "IM", "tópica"
      },

      inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: { msg: 'La fecha de inicio debe ser una fecha válida.' },
        },
      },

      fin: {
        type: DataTypes.DATEONLY,
        allowNull: true,              // NULL = medicación crónica sin fecha de corte
        validate: {
          isDate: { msg: 'La fecha de fin debe ser una fecha válida.' },
          esDespuesDeInicio(value) {
            if (value && this.inicio && new Date(value) < new Date(this.inicio)) {
              throw new Error('La fecha de fin no puede ser anterior al inicio.');
            }
          },
        },
      },

      indicacion: {
        type: DataTypes.TEXT,
        allowNull: true,              // motivo clínico de la prescripción
      },

      prescripto_por_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'RESTRICT',
      },

      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: 'Medicacion',
      tableName: 'medicaciones',
      underscored: true,            // mapea camelCase → snake_case automáticamente
      timestamps: true,
      createdAt: 'creado_en',
      updatedAt: false,             // la tabla no tiene updated_at según el esquema

      scopes: {
        /** Sólo medicaciones activas y vigentes a hoy */
        activas: {
          where: {
            activo: true,
          },
        },

        /** Incluye paciente y prescriptor en la consulta */
        completa: (models) => ({
          include: [
            { model: models.Paciente, as: 'paciente', attributes: ['id', 'nombre', 'apellido', 'dni'] },
            { model: models.User,     as: 'prescriptoPor', attributes: ['id', 'nombre_completo', 'rol'] },
          ],
        }),
      },
    }
  );

  return Medicacion;
};

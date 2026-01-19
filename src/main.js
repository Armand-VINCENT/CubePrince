import "./style.css";

AFRAME.registerComponent("boundary", {
  schema: {
    minX: { type: "number", default: -5 },
    maxX: { type: "number", default: 5 },
    minZ: { type: "number", default: -5 },
    maxZ: { type: "number", default: 5 },
  },

  init: function () {
    console.log("Boundary component initialized with:", this.data);
  },

  tick: function () {
    const position = this.el.object3D.position;

    // Sauvegarder les positions originales
    const originalX = position.x;
    const originalZ = position.z;

    // Contraindre la position dans les limites définies
    position.x = Math.max(this.data.minX, Math.min(this.data.maxX, position.x));
    position.z = Math.max(this.data.minZ, Math.min(this.data.maxZ, position.z));

    // Log si on a contraint la position
    if (originalX !== position.x || originalZ !== position.z) {
      console.log(
        `Position contrainte: (${originalX.toFixed(2)}, ${originalZ.toFixed(2)}) -> (${position.x.toFixed(2)}, ${position.z.toFixed(2)})`,
      );
    }
  },
});

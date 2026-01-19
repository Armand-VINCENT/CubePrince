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

AFRAME.registerComponent("wall-flight", {
  schema: {
    height: { type: "number", default: 12 },
    speed: { type: "number", default: 2 },
    offset: { type: "number", default: 2 },
  },

  init: function () {
    this.currentWaypoint = 0;
    // Points le long des 4 murs (avec offset pour ne pas toucher les murs)
    const offset = this.data.offset;
    this.waypoints = [
      { x: 16 - offset, z: -16 + offset }, // Coin Nord-Est
      { x: 16 - offset, z: 16 - offset }, // Coin Sud-Est
      { x: -16 + offset, z: 16 - offset }, // Coin Sud-Ouest
      { x: -16 + offset, z: -16 + offset }, // Coin Nord-Ouest
    ];
  },

  tick: function (time, delta) {
    const position = this.el.object3D.position;
    const target = this.waypoints[this.currentWaypoint];

    // Direction vers le point cible
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Si on est proche du waypoint, passer au suivant
    if (distance < 0.5) {
      this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
      return;
    }

    // Se déplacer vers le waypoint
    const speed = (this.data.speed * delta) / 1000;
    position.x += (dx / distance) * speed;
    position.z += (dz / distance) * speed;
    position.y = this.data.height;

    // Orienter l'avion selon le mur qu'il longe
    const angle = Math.atan2(dz, dx);

    // Segments : 0=Est, 1=Sud, 2=Ouest, 3=Nord
    // Pour Nord et Sud (1, 3) : regarder à gauche
    // Pour Est et Ouest (0, 2) : regarder à droite
    if (this.currentWaypoint === 1 || this.currentWaypoint === 3) {
      // Murs Nord et Sud : regarder à gauche
      this.el.object3D.rotation.y = angle + Math.PI;
    } else {
      // Murs Est et Ouest : regarder à droite
      this.el.object3D.rotation.y = angle;
    }
  },
});

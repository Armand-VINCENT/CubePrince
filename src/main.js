import "./style.css";

// Composant pour gérer les déplacements VR avec les joysticks
AFRAME.registerComponent("thumbstick-logging", {
  init: function () {
    this.el.addEventListener("thumbstickmoved", this.logThumbstick);
  },
  logThumbstick: function (evt) {
    if (evt.detail.y > 0.95) console.log("UP", evt.detail.y);
    if (evt.detail.y < -0.95) console.log("DOWN", evt.detail.y);
    if (evt.detail.x < -0.95) console.log("LEFT", evt.detail.x);
    if (evt.detail.x > 0.95) console.log("RIGHT", evt.detail.x);
  },
});

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
    rotationSpeed: { type: "number", default: 0.05 },
  },

  init: function () {
    this.currentWaypoint = 0;
    this.targetRotation = 0;
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

    // Calculer la rotation cible selon le mur qu'il longe
    const angle = Math.atan2(dz, dx);

    // Segments : 0=Est, 1=Sud, 2=Ouest, 3=Nord
    // Pour Nord et Sud (1, 3) : regarder à gauche
    // Pour Est et Ouest (0, 2) : regarder à droite
    if (this.currentWaypoint === 1 || this.currentWaypoint === 3) {
      // Murs Nord et Sud : regarder à gauche
      this.targetRotation = angle + Math.PI;
    } else {
      // Murs Est et Ouest : regarder à droite
      this.targetRotation = angle;
    }

    // Interpolation fluide de la rotation (lerp)
    let currentRotation = this.el.object3D.rotation.y;
    let diff = this.targetRotation - currentRotation;

    // Normaliser la différence entre -PI et PI
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    // Appliquer l'interpolation
    this.el.object3D.rotation.y += diff * this.data.rotationSpeed;
  },
});

AFRAME.registerComponent("day-night-cycle", {
  schema: {
    cycleDuration: { type: "number", default: 30000 }, // Durée en millisecondes
  },

  init: function () {
    this.elapsedTime = 0;
    this.isNight = false;
    this.audioStarted = false;
    this.initialPosition = null;

    // Récupérer le ciel
    this.sky = this.el.sceneEl.querySelector("a-sky");

    // Récupérer le rig pour détecter le mouvement
    this.rig = document.querySelector("#rig");

    // Créer les lumières
    const ambientLight = document.createElement("a-entity");
    ambientLight.setAttribute("light", {
      type: "ambient",
      color: "#ffffff",
      intensity: 0.8,
    });
    ambientLight.setAttribute("id", "ambient-light");
    this.el.sceneEl.appendChild(ambientLight);

    const directionalLight = document.createElement("a-entity");
    directionalLight.setAttribute("light", {
      type: "directional",
      color: "#ffffff",
      intensity: 0.5,
    });
    directionalLight.setAttribute("position", "0 20 0");
    directionalLight.setAttribute("id", "directional-light");
    this.el.sceneEl.appendChild(directionalLight);

    this.ambientLight = ambientLight;
    this.directionalLight = directionalLight;

    // Créer l'élément audio pour la nuit
    const nightSound = document.createElement("a-entity");
    nightSound.setAttribute(
      "sound",
      "src: ./Chouette.mp3; loop: true; autoplay: false; volume: 0.5",
    );
    nightSound.setAttribute("id", "night-sound");
    this.el.sceneEl.appendChild(nightSound);
    this.nightSound = nightSound;
    this.soundReady = false;

    // Attendre que le son soit chargé
    nightSound.addEventListener("sound-loaded", () => {
      this.soundReady = true;
      console.log("Son de chouette chargé");
    });
  },

  tick: function (time, delta) {
    this.elapsedTime += delta;

    // Détecter le mouvement du joueur pour démarrer l'audio
    if (!this.audioStarted && this.rig) {
      const currentPos = this.rig.object3D.position;

      if (!this.initialPosition) {
        this.initialPosition = {
          x: currentPos.x,
          y: currentPos.y,
          z: currentPos.z,
        };
      } else {
        // Calculer la distance parcourue
        const dx = currentPos.x - this.initialPosition.x;
        const dz = currentPos.z - this.initialPosition.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Si le joueur a bougé de plus de 0.1 unité, démarrer l'audio
        if (distance > 0.1) {
          const windSound = document.querySelector("#wind-sound");
          if (windSound && windSound.components.sound) {
            windSound.components.sound.playSound();
            console.log("Son de vent démarré au premier mouvement");
          }
          this.audioStarted = true;
        }
      }
    }

    // Calculer le cycle (0 = jour, 0.5 = nuit, 1 = jour)
    const cycle =
      (this.elapsedTime % this.data.cycleDuration) / this.data.cycleDuration;

    // Utiliser une fonction sinus pour une transition douce
    const lightIntensity = (Math.sin(cycle * Math.PI * 2) + 1) / 2; // Valeur entre 0 et 1

    // Intensité ambiante varie de 0.2 (nuit) à 0.8 (jour)
    const ambientIntensity = 0.2 + lightIntensity * 0.6;

    // Intensité directionnelle varie de 0 (nuit) à 0.5 (jour)
    const directionalIntensity = lightIntensity * 0.5;

    // Couleur change légèrement (jour = blanc, nuit = bleuâtre)
    const dayColor = { r: 1, g: 1, b: 1 };
    const nightColor = { r: 0.5, g: 0.6, b: 0.8 };

    const r = nightColor.r + (dayColor.r - nightColor.r) * lightIntensity;
    const g = nightColor.g + (dayColor.g - nightColor.g) * lightIntensity;
    const b = nightColor.b + (dayColor.b - nightColor.b) * lightIntensity;

    const color = `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`;

    // Appliquer les changements
    this.ambientLight.setAttribute("light", "intensity", ambientIntensity);
    this.ambientLight.setAttribute("light", "color", color);
    this.directionalLight.setAttribute(
      "light",
      "intensity",
      directionalIntensity,
    );

    // Mettre à jour la couleur du ciel
    if (this.sky) {
      // Couleur du ciel : jour = bleu clair, nuit = bleu très foncé/noir
      const skydayColor = { r: 110, g: 186, b: 167 }; // #6EBAA7
      const skyNightColor = { r: 10, g: 15, b: 35 }; // Presque noir avec teinte bleue

      const skyR =
        skyNightColor.r + (skydayColor.r - skyNightColor.r) * lightIntensity;
      const skyG =
        skyNightColor.g + (skydayColor.g - skyNightColor.g) * lightIntensity;
      const skyB =
        skyNightColor.b + (skydayColor.b - skyNightColor.b) * lightIntensity;

      const skyColor = `rgb(${Math.floor(skyR)}, ${Math.floor(skyG)}, ${Math.floor(skyB)})`;
      this.sky.setAttribute("color", skyColor);
    }

    // Gérer le son de nuit (quand lightIntensity < 0.5, c'est la nuit)
    if (this.soundReady) {
      const isNightNow = lightIntensity < 0.5;

      if (isNightNow && !this.isNight) {
        // Passage au cycle de nuit
        try {
          this.nightSound.components.sound.playSound();
          console.log("Son de nuit démarré");
        } catch (e) {
          console.error("Erreur lecture son:", e);
        }
        this.isNight = true;
      } else if (!isNightNow && this.isNight) {
        // Passage au cycle de jour
        try {
          this.nightSound.components.sound.stopSound();
          console.log("Son de nuit arrêté");
        } catch (e) {
          console.error("Erreur arrêt son:", e);
        }
        this.isNight = false;
      }
    }
  },
});

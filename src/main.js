import "./style.css";

// Composant pour gérer le clic sur la chaise et déclencher le coucher de soleil
AFRAME.registerComponent("sunset-trigger", {
  init: function () {
    this.el.addEventListener("click", () => {
      console.log("🪑 Clic sur la chaise détecté");

      // Trouver le composant day-night-cycle et démarrer l'animation
      const scene = this.el.sceneEl;
      const dayNightCycle = scene.components["day-night-cycle"];

      if (
        dayNightCycle &&
        !dayNightCycle.sunsetAnimationActive &&
        !dayNightCycle.cycleActive
      ) {
        dayNightCycle.startSunsetAnimation();
      } else {
        console.log("Animation déjà en cours ou cycle déjà actif");
      }
    });
  },
});

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

// Composant pour afficher un corps simple en VR
AFRAME.registerComponent("vr-body", {
  init: function () {
    const camera = this.el.sceneEl.camera.el;

    // Créer les jambes
    const leftLeg = document.createElement("a-cylinder");
    leftLeg.setAttribute("radius", "0.08");
    leftLeg.setAttribute("height", "0.7");
    leftLeg.setAttribute("color", "#3366cc");
    leftLeg.setAttribute("position", "-0.1 -1.15 -0.1");
    camera.appendChild(leftLeg);

    const rightLeg = document.createElement("a-cylinder");
    rightLeg.setAttribute("radius", "0.08");
    rightLeg.setAttribute("height", "0.7");
    rightLeg.setAttribute("color", "#3366cc");
    rightLeg.setAttribute("position", "0.1 -1.15 -0.1");
    camera.appendChild(rightLeg);

    console.log("✅ Corps VR ajouté");
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
    autoStart: { type: "boolean", default: false }, // Ne démarre pas automatiquement
  },

  init: function () {
    this.elapsedTime = 0;
    this.isNight = false;
    this.audioStarted = false;
    this.cycleActive = this.data.autoStart; // Contrôle du cycle
    this.sunsetAnimationActive = false; // Pour l'animation du coucher de soleil
    this.sunsetProgress = 0; // Progression de l'animation du coucher (0 à 1)

    // Récupérer le ciel
    this.sky = this.el.sceneEl.querySelector("a-sky");

    // Gérer le bouton de démarrage
    const startOverlay = document.querySelector("#start-overlay");
    if (startOverlay) {
      startOverlay.addEventListener("click", () => {
        console.log("🎵 Tentative de démarrage du son de vent...");

        // Démarrer le son de vent
        const windSound = document.querySelector("#wind-sound");
        if (windSound && windSound.components.sound) {
          try {
            windSound.components.sound.playSound();
            console.log("✅ Son de vent démarré avec succès !");
          } catch (error) {
            console.error("❌ Erreur lors du démarrage du son de vent:", error);
          }
        } else {
          console.warn(
            "⚠️ Élément son de vent non trouvé ou composant sound non initialisé",
          );
        }

        this.audioStarted = true;

        // Masquer l'overlay
        startOverlay.style.display = "none";
        console.log("🎬 Overlay masqué - Expérience démarrée");
      });
    }

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

    // Créer les étoiles
    this.stars = [];
    const starsContainer = document.createElement("a-entity");
    starsContainer.setAttribute("id", "stars-container");
    this.el.sceneEl.appendChild(starsContainer);

    // Générer 200 étoiles aléatoires
    for (let i = 0; i < 200; i++) {
      const star = document.createElement("a-sphere");

      // Position aléatoire dans une sphère autour du joueur
      const theta = Math.random() * Math.PI * 2; // Angle horizontal
      const phi = (Math.random() * Math.PI) / 2; // Angle vertical (seulement au-dessus)
      const radius = 80 + Math.random() * 40; // Distance entre 80 et 120

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi) + 20; // Au-dessus de l'horizon
      const z = radius * Math.sin(phi) * Math.sin(theta);

      star.setAttribute("position", `${x} ${y} ${z}`);
      star.setAttribute("radius", 0.3 + Math.random() * 0.4);
      star.setAttribute("material", "shader: flat; color: #ffffff");
      star.setAttribute("opacity", 0); // Invisible au début

      // Ajouter des propriétés pour le scintillement
      star.userData = {
        baseOpacity: 0.7 + Math.random() * 0.3,
        twinkleSpeed: 0.001 + Math.random() * 0.002,
        twinklePhase: Math.random() * Math.PI * 2,
      };

      starsContainer.appendChild(star);
      this.stars.push(star);
    }

    console.log("✨ 200 étoiles créées");

    // Créer le soleil
    const sun = document.createElement("a-sphere");
    sun.setAttribute("radius", "8");
    sun.setAttribute("material", "shader: flat; color: #ffff00");
    sun.setAttribute("id", "sun");
    sun.setAttribute("position", "0 50 -50"); // Position initiale visible dans le ciel
    sun.setAttribute("opacity", "1"); // Visible au départ
    this.el.sceneEl.appendChild(sun);
    this.sun = sun;

    // Créer la lune
    const moon = document.createElement("a-sphere");
    moon.setAttribute("radius", "6");
    moon.setAttribute("material", "shader: flat; color: #cccccc");
    moon.setAttribute("id", "moon");
    moon.setAttribute("position", "0 -50 50"); // Position initiale sous l'horizon
    moon.setAttribute("opacity", "0"); // Invisible au départ
    this.el.sceneEl.appendChild(moon);
    this.moon = moon;

    console.log("☀️ Soleil et 🌙 Lune créés");

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

  startSunsetAnimation: function () {
    console.log("🌅 Démarrage de l'animation du coucher de soleil");
    this.sunsetAnimationActive = true;
    this.sunsetProgress = 0;
    this.sunsetStartTime = Date.now();
  },

  tick: function (time, delta) {
    // Gestion de l'animation du coucher de soleil (8 secondes)
    if (this.sunsetAnimationActive) {
      const sunsetDuration = 8000; // 8 secondes
      this.sunsetProgress = Math.min(
        1,
        (Date.now() - this.sunsetStartTime) / sunsetDuration,
      );

      // Interpolation de couleur du ciel : bleu (#90D9DE) vers orange (#FF4500)
      const blueColor = { r: 0x90, g: 0xd9, b: 0xde };
      const orangeColor = { r: 0xff, g: 0x45, b: 0x00 };

      const r = Math.floor(
        blueColor.r + (orangeColor.r - blueColor.r) * this.sunsetProgress,
      );
      const g = Math.floor(
        blueColor.g + (orangeColor.g - blueColor.g) * this.sunsetProgress,
      );
      const b = Math.floor(
        blueColor.b + (orangeColor.b - blueColor.b) * this.sunsetProgress,
      );

      const skyColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      this.sky.setAttribute("color", skyColor);

      // Fin de l'animation du coucher de soleil
      if (this.sunsetProgress >= 1) {
        this.sunsetAnimationActive = false;
        this.cycleActive = true; // Démarrer le cycle jour/nuit
        this.elapsedTime = 0; // Réinitialiser pour commencer le cycle de nuit
        console.log("🌙 Cycle jour/nuit activé");
      }

      return; // Ne pas exécuter le reste si on est en animation de coucher de soleil
    }

    // Le cycle jour/nuit ne s'exécute que si cycleActive est true
    if (!this.cycleActive) return;

    this.elapsedTime += delta;

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

    // Animer le soleil et la lune
    if (this.sun && this.moon) {
      // Utiliser cycle pour une rotation continue (0 à 1 = 0° à 360°)
      // cycle = 0 -> aube (soleil à l'horizon Est)
      // cycle = 0.25 -> midi (soleil au zénith, lightIntensity = 1)
      // cycle = 0.5 -> crépuscule (soleil à l'horizon Ouest)
      // cycle = 0.75 -> minuit (soleil en bas, lune au zénith, lightIntensity = 0)

      const radius = 100; // Distance du centre
      const playerPos = this.rig
        ? this.rig.object3D.position
        : { x: 0, y: 0, z: 0 };

      // Calculer l'angle basé sur cycle pour une rotation continue
      // cycle * 2π donne une rotation complète
      const sunAngle = cycle * Math.PI * 2;

      const sunX = playerPos.x;
      const sunY = Math.sin(sunAngle) * radius;
      const sunZ = playerPos.z + Math.cos(sunAngle) * radius;

      this.sun.setAttribute("position", `${sunX} ${sunY} ${sunZ}`);

      // Position de la lune (opposée au soleil, décalage de π)
      const moonAngle = sunAngle + Math.PI;
      const moonX = playerPos.x;
      const moonY = Math.sin(moonAngle) * radius;
      const moonZ = playerPos.z + Math.cos(moonAngle) * radius;

      this.moon.setAttribute("position", `${moonX} ${moonY} ${moonZ}`);

      // Opacité du soleil et de la lune (visible uniquement au-dessus de l'horizon)
      const sunOpacity = sunY > 0 ? 1 : 0;
      const moonOpacity = moonY > 0 ? 1 : 0;

      this.sun.setAttribute("opacity", sunOpacity);
      this.moon.setAttribute("opacity", moonOpacity);
    }

    // Gérer l'apparition et le scintillement des étoiles
    if (this.stars && this.stars.length > 0) {
      // Calculer l'opacité cible selon le cycle jour/nuit
      // Les étoiles sont visibles la nuit (lightIntensity < 0.5)
      const targetOpacity = lightIntensity < 0.5 ? 1 : 0;

      this.stars.forEach((star) => {
        const userData = star.userData;

        // Transition douce de l'opacité
        let currentOpacity = parseFloat(star.getAttribute("opacity") || 0);
        const opacityDelta = (targetOpacity - currentOpacity) * 0.01;
        currentOpacity += opacityDelta;

        // Si les étoiles sont visibles, ajouter le scintillement
        if (currentOpacity > 0.1) {
          userData.twinklePhase += userData.twinkleSpeed * delta;
          const twinkle = Math.sin(userData.twinklePhase) * 0.3;
          const finalOpacity = Math.max(
            0,
            Math.min(1, currentOpacity * userData.baseOpacity + twinkle),
          );
          star.setAttribute("opacity", finalOpacity);
        } else {
          star.setAttribute("opacity", currentOpacity);
        }
      });
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

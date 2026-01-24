class ThreeBackground {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.scene = new THREE.Scene();
        // Nata Cola Red-ish background fog
        this.scene.fog = new THREE.FogExp2(0x8B0000, 0.002);
        this.scene.background = new THREE.Color(0x8B0000);

        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.camera.position.z = 50;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.bubbles = [];
        this.initBubbles();

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(25, 50, 25);
        this.scene.add(pointLight);

        this.animate = this.animate.bind(this);
        this.handleResize = this.handleResize.bind(this);

        window.addEventListener('resize', this.handleResize);

        this.animate();
    }

    initBubbles() {
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6,
            shininess: 100
        });

        for (let i = 0; i < 50; i++) {
            const bubble = new THREE.Mesh(geometry, material);

            // Random position
            bubble.position.x = (Math.random() - 0.5) * 100;
            bubble.position.y = (Math.random() - 0.5) * 100;
            bubble.position.z = (Math.random() - 0.5) * 50;

            // Random scale
            const scale = Math.random() * 2 + 0.5;
            bubble.scale.set(scale, scale, scale);

            // Custom properties for animation
            bubble.userData = {
                speed: Math.random() * 0.2 + 0.05,
                wobbleSpeed: Math.random() * 2,
                wobbleOffset: Math.random() * Math.PI * 2
            };

            this.scene.add(bubble);
            this.bubbles.push(bubble);
        }
    }

    animate(time) {
        requestAnimationFrame(this.animate);

        const seconds = time * 0.001;

        this.bubbles.forEach(bubble => {
            bubble.position.y += bubble.userData.speed;
            bubble.position.x += Math.sin(seconds * bubble.userData.wobbleSpeed + bubble.userData.wobbleOffset) * 0.02;

            // Reset if goes too high
            if (bubble.position.y > 60) {
                bubble.position.y = -60;
                bubble.position.x = (Math.random() - 0.5) * 100;
            }
        });

        this.renderer.render(this.scene, this.camera);
    }

    handleResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(this.width, this.height);
    }
}

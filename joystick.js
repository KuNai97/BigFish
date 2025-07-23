
const joystick = {
  x: 0,
  y: 0
};
window.joystick = joystick;
(function setupJoystick(){
    const zone = document.getElementById("joystick-zone");
    let startX = 0, startY = 0;
    zone.addEventListener('touchstart',(e)=>{
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
    });
    zone.addEventListener('touchmove',(e)=>{
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        //范围控制
        const distance  = Math.min(Math.sqrt(dx * dx + dy * dy),50);
        const angle = Math.atan(dy,dx);

        joystick.x = Math.cos(angle) * (distance / 50);
        joystick.y = Math.sin(angle) * (distance / 50);
        
    });
    zone.addEventListener('touchend',()=>{
        joystick.x = 0;
        joystick.y = 0;
    });
})();

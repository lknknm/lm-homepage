document.addEventListener('DOMContentLoaded', () => {

    // const dropdown = document.querySelector('.dropdown');
    // dropdown.addEventListener('mouseover', () => {
    //     document.querySelector(".home-textbox").style.filter = "blur(3px)";
    //     document.querySelector(".backdrop").style.backdropFilter = "blur(10px)";
    // });
    // dropdown.addEventListener('mouseout', () => {
    //     document.querySelector(".home-textbox").style.filter = "blur(0px)";
    //     document.querySelector(".backdrop").style.backdropFilter = "blur(0px)";
    // });

    const navBarMenu = document.getElementById('navbar-menu'),
        toggleMenu = document.getElementById('toggle-menu'),
        closeMenu = document.getElementById('close-menu')
    
    toggleMenu.addEventListener('click', () => {
        navBarMenu.classList.toggle('show-menu');
    })

    closeMenu.addEventListener('click', () => {
        navBarMenu.classList.remove('show-menu')
    })
})
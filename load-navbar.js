document.addEventListener('DOMContentLoaded', () => {
    fetch('navbar.html')
        .then(response => response.text())
        .then(data => {
            document.querySelector('.navbar-container').innerHTML = data;
        })
        .catch(error => console.error('Error loading navbar:', error));

        fetch('auth.html')
         .then(response => response.text())
         .then(html => {
            document.getElementById('auth-container-placeholder').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading auth UI:', error);
        });
});

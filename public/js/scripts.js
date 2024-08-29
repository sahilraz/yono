document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registration-form');
    form.reset();
    // Extract the dynamic userPath from the current URL
    const pathArray = window.location.pathname.split('/');
    const userPath = pathArray[1];
    form.action = `/${userPath}/register`;

    // Handle form field changes
    form.addEventListener('input', (event) => {
        const field = event.target.name;
        const value = event.target.value;
        if (field) {
            updateField(userPath, field, value);
        }
    });

    // Function to update field via fetch
    function updateField(userPath, field, value) {
        const csrfToken = document.querySelector('input[name="_csrf"]').value;

        fetch(`/${userPath}/update`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `field=${encodeURIComponent(field)}&value=${encodeURIComponent(value)}&_csrf=${encodeURIComponent(csrfToken)}`,
        })
        .then(response => response.text())
        .then(data => console.log(data))
        .catch(error => console.error('Error:', error));
    }
});

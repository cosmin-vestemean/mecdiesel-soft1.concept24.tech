import { client } from '../socketConfig.js';

$(document).ready(() => {
    const $loginForm = $('#loginForm');
    const $loginActualForm = $('#loginActualForm');
    const $userSelect = $('#userSelect');
    const $passwordInput = $('#passwordInput');
    const $loginButton = $('#loginButton');
    const $loginError = $('#loginError');
    const $appContainer = $('#app');

    // Function to show login errors
    function showLoginError(message) {
        $loginError.find('.error-message').text(message);
        $loginError.removeClass('d-none');
    }

    // Function to hide login errors
    function hideLoginError() {
        $loginError.addClass('d-none');
    }

    // Fetch registered users and populate the dropdown
    async function populateUsers() {
        try {
            // Clear previous errors and state
            hideLoginError();
            $userSelect.empty().append('<option value="" disabled selected>Loading users...</option>');

            const result = await client.service('s1').getRegisteredUsers({});
            
            if (result.success && result.users) {
                console.log("Received users:", result.users); // Log the received users array
                
                // Store the session token obtained from the internal login
                if (result.clientID) {
                    sessionStorage.setItem('s1SessionToken', result.clientID);
                    console.log("Session token stored:", result.clientID);
                } else {
                    console.warn("No clientID (session token) received from getRegisteredUsers");
                    showLoginError("Failed to establish session. Cannot proceed.");
                    $userSelect.empty().append('<option value="" disabled selected>Session Error</option>'); // Update dropdown on error
                    return; // Stop if no session token
                }

                $userSelect.empty(); // Clear loading message
                $userSelect.append('<option value="" disabled selected>Select user</option>');
                result.users.forEach(user => {
                    // Use REFIDNAME for display text and REFID for the option value
                    console.log("Processing user:", user); // Log each user object
                    const userName = user.REFIDNAME; // Use REFIDNAME for display text
                    const userValue = user.REFID;    // Use REFID for the value (likely the clientID needed for validation)

                    // Filter out the user named "WEB"
                    if (userName === "WEB") {
                        console.log("Skipping user 'WEB'");
                        return; // Skip this iteration
                    }

                    if (userName && userValue !== undefined) { // Check if we have valid text and value
                      $userSelect.append($('<option>', {
                          value: userValue,
                          text: userName
                      }));
                    } else {
                      console.warn("Skipping user due to missing REFIDNAME or REFID:", user);
                    }
                });
            } else {
                // Use the specific error from the server
                const errorMessage = result.error || 'Failed to load users.';
                showLoginError(errorMessage); 
                $userSelect.empty().append(`<option value="" disabled selected>Error: ${errorMessage}</option>`);
            } 
        } catch (error) {
            console.error('Error fetching registered users:', error);
            const networkError = 'Network error or server unavailable while fetching users.';
            showLoginError(networkError);
            $userSelect.empty().append(`<option value="" disabled selected>${networkError}</option>`);
        }
    }

    // Handle login form submission
    $loginActualForm.on('submit', async (event) => {
        event.preventDefault();
        hideLoginError();
        $loginButton.prop('disabled', true).text('Logging in...');

        const selectedRefId = $userSelect.val(); // This is the REFID of the selected user
        const password = $passwordInput.val();
        const sessionToken = sessionStorage.getItem('s1SessionToken'); // Retrieve the stored session token

        if (!sessionToken) {
            showLoginError('Session token missing. Please refresh and try again.');
            $loginButton.prop('disabled', false).text('Login');
            return;
        }
        if (!selectedRefId) {
            showLoginError('Please select a user.');
            $loginButton.prop('disabled', false).text('Login');
            return;
        }
        if (!password) {
            showLoginError('Please enter your password.');
            $loginButton.prop('disabled', false).text('Login');
            return;
        }

        try {
            // Send sessionToken, selectedRefId (as clientID for the method), and password
            const validationResult = await client.service('s1').validateUserPwd({
                sessionToken: sessionToken,
                clientID: selectedRefId, // Pass selected user's REFID as clientID for validation context
                password: password
            });

            if (validationResult.success) {
                // Login successful
                $loginForm.addClass('d-none'); // Hide login form
                
                // Show main app components (now separated in DOM)
                $('#workspace').removeClass('d-none'); // Reveal workspace layout
                $('#header').removeClass('d-none'); // Show header
                $appContainer.removeClass('d-none'); // Show main app content
                $('#footer').removeClass('d-none'); // Show footer
                $('#headerToggle').removeClass('d-none'); // Show header toggle button
                
                // Trigger bounce animation to alert user of new functionality
                setTimeout(() => {
                  const headerToggle = document.getElementById('headerToggle');
                  if (headerToggle) {
                    console.log('Starting bounce animation for headerToggle');
                    headerToggle.classList.add('bounce-alert');
                    // Remove class after animation completes (3 bounces * 0.8s = 2.4s)
                    setTimeout(() => {
                      headerToggle.classList.remove('bounce-alert');
                      console.log('Bounce animation completed for headerToggle');
                    }, 2500);
                  } else {
                    console.warn('headerToggle button not found for bounce animation');
                  }
                }, 300); // Delay to ensure button is visible and rendered
                
                // Trigger bounce animation for logout button
                setTimeout(() => {
                  const logoutButton = document.getElementById('logoutButton');
                  if (logoutButton) {
                    console.log('Starting bounce animation for logoutButton');
                    logoutButton.classList.add('bounce-alert');
                    // Remove class after animation completes (3 bounces * 0.8s = 2.4s)
                    setTimeout(() => {
                      logoutButton.classList.remove('bounce-alert');
                      console.log('Bounce animation completed for logoutButton');
                    }, 2500);
                  } else {
                    console.warn('logoutButton not found for bounce animation');
                  }
                }, 400); // Slightly delayed after headerToggle
                
                // Store the potentially refreshed token/clientID from the validation result
                // Use validationResult.clientID which should be returned from the backend
                sessionStorage.setItem('s1Token', validationResult.clientID); 
                // Remove the temporary session token used only for validation setup
                sessionStorage.removeItem('s1SessionToken');

                // Trigger the main application initialization
                if (window.initializeApp) {
                    window.initializeApp();
                } else {
                    console.error('initializeApp function not found. Main app might not load correctly.');
                }

            } else {
                // Login failed
                showLoginError(validationResult.error || 'Invalid username or password.');
                $loginButton.prop('disabled', false).text('Login');
            }
        } catch (error) {
            console.error('Login error:', error);
            showLoginError('An error occurred during login. Please try again.');
            $loginButton.prop('disabled', false).text('Login');
        }
    });

    // Initial population of users
    populateUsers();
});

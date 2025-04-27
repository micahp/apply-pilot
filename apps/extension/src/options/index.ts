// Tab switching
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove active class from all tabs and contents
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    // Add active class to clicked tab and corresponding content
    tab.classList.add('active');
    const tabName = tab.getAttribute('data-tab');
    if (tabName) {
      document.getElementById(`${tabName}-tab`)?.classList.add('active');
    }
  });
});

// Resume upload
const resumeUploadInput = document.getElementById('resume-upload') as HTMLInputElement;
const selectResumeBtn = document.getElementById('select-resume');
const uploadStatus = document.getElementById('upload-status');
const progressFill = document.getElementById('progress-fill');

if (selectResumeBtn) {
  selectResumeBtn.addEventListener('click', () => {
    resumeUploadInput?.click();
  });
}

if (resumeUploadInput) {
  resumeUploadInput.addEventListener('change', (e) => {
    const file = resumeUploadInput.files?.[0];
    if (!file) return;
    
    if (uploadStatus) {
      uploadStatus.textContent = 'Processing resume...';
    }
    
    if (progressFill) {
      progressFill.style.width = '30%';
    }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (progressFill) {
          progressFill.style.width = '60%';
        }
        
        // Send the file to our resume parsing API
        await parseResume(file);
        
        if (progressFill) {
          progressFill.style.width = '100%';
        }
        
        if (uploadStatus) {
          uploadStatus.textContent = 'Resume processed successfully!';
        }
        
        // After a delay, reset the progress bar
        setTimeout(() => {
          if (progressFill) {
            progressFill.style.width = '0%';
          }
        }, 2000);
      } catch (error) {
        console.error('Error processing resume:', error);
        
        if (uploadStatus) {
          uploadStatus.textContent = 'Error processing resume. Please try again.';
        }
        
        if (progressFill) {
          progressFill.style.width = '0%';
        }
      }
    };
    
    reader.onerror = () => {
      if (uploadStatus) {
        uploadStatus.textContent = 'Error reading file. Please try again.';
      }
      
      if (progressFill) {
        progressFill.style.width = '0%';
      }
    };
    
    reader.readAsDataURL(file);
  });
}

// Simulate resume parsing (in a real extension, this would call a server API)
async function parseResume(file: File) {
  // For now, we'll use a simulated parsing function
  // In a real implementation, this would be an API call to a resume parsing service
  
  return new Promise((resolve) => {
    // Simulate API delay
    setTimeout(() => {
      // Simulate parsed resume data
      const parsedData = simulateResumeParsing(file.name);
      
      // Update the profile with parsed data
      updateProfileWithResumeData(parsedData);
      
      resolve(parsedData);
    }, 1500);
  });
}

// Simulate resume parsing based on filename (for demo purposes)
function simulateResumeParsing(fileName: string) {
  // In a real implementation, this would be replaced with actual parsing logic
  // This is just a placeholder to demonstrate the UI flow
  const lowerFileName = fileName.toLowerCase();
  
  // Return simulated resume data
  return {
    personal: {
      firstName: lowerFileName.includes('john') ? 'John' : 'Jane',
      lastName: lowerFileName.includes('doe') ? 'Doe' : 'Smith',
      email: lowerFileName.includes('john') ? 'john.doe@example.com' : 'jane.smith@example.com',
      phone: '(555) 123-4567',
      location: {
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'USA'
      }
    },
    experience: [
      {
        company: 'Acme Corporation',
        title: 'Senior Software Engineer',
        startDate: '2019-01',
        endDate: '',
        description: 'Developed and maintained web applications using React, Node.js, and AWS.',
        location: 'San Francisco, CA'
      },
      {
        company: 'Tech Innovations',
        title: 'Software Engineer',
        startDate: '2016-05',
        endDate: '2018-12',
        description: 'Full-stack development with Angular and Django.',
        location: 'San Francisco, CA'
      }
    ],
    education: [
      {
        institution: 'Stanford University',
        degree: 'Master of Science',
        field: 'Computer Science',
        startDate: '2014-09',
        endDate: '2016-05',
        gpa: '3.8'
      },
      {
        institution: 'University of California, Berkeley',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        startDate: '2010-09',
        endDate: '2014-05',
        gpa: '3.7'
      }
    ],
    skills: ['JavaScript', 'React', 'Node.js', 'Python', 'Django', 'AWS', 'Docker']
  };
}

interface ParsedData {
  personal: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    location?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
  experience?: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
    description: string;
    location?: string;
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate?: string;
    gpa?: string;
  }>;
  skills?: string[];
}

// Update the form fields with parsed resume data
function updateProfileWithResumeData(parsedData: ParsedData) {
  // Update personal information
  if (parsedData.personal) {
    const personal = parsedData.personal;
    const firstNameEl = document.getElementById('firstName') as HTMLInputElement;
    const lastNameEl = document.getElementById('lastName') as HTMLInputElement;
    const emailEl = document.getElementById('email') as HTMLInputElement;
    const phoneEl = document.getElementById('phone') as HTMLInputElement;
    
    if (firstNameEl) firstNameEl.value = personal.firstName || '';
    if (lastNameEl) lastNameEl.value = personal.lastName || '';
    if (emailEl) emailEl.value = personal.email || '';
    if (phoneEl) phoneEl.value = personal.phone || '';
    
    if (personal.location) {
      const streetEl = document.getElementById('street') as HTMLInputElement;
      const cityEl = document.getElementById('city') as HTMLInputElement;
      const stateEl = document.getElementById('state') as HTMLInputElement;
      const postalCodeEl = document.getElementById('postalCode') as HTMLInputElement;
      const countryEl = document.getElementById('country') as HTMLInputElement;
      
      if (streetEl) streetEl.value = personal.location.street || '';
      if (cityEl) cityEl.value = personal.location.city || '';
      if (stateEl) stateEl.value = personal.location.state || '';
      if (postalCodeEl) postalCodeEl.value = personal.location.postalCode || '';
      if (countryEl) countryEl.value = personal.location.country || '';
    }
  }
  
  // Update experience
  if (parsedData.experience && parsedData.experience.length > 0) {
    // Clear existing experience items
    const experienceContainer = document.getElementById('experience-container');
    if (experienceContainer) {
      experienceContainer.innerHTML = '';
      
      // Add new experience items
      parsedData.experience.forEach((exp, index) => {
        const expItem = createExperienceItem(exp, index);
        experienceContainer.appendChild(expItem);
      });
    }
  }
  
  // Update education
  if (parsedData.education && parsedData.education.length > 0) {
    // Clear existing education items
    const educationContainer = document.getElementById('education-container');
    if (educationContainer) {
      educationContainer.innerHTML = '';
      
      // Add new education items
      parsedData.education.forEach((edu, index) => {
        const eduItem = createEducationItem(edu, index);
        educationContainer.appendChild(eduItem);
      });
    }
  }
  
  // Store the parsed data
  chrome.storage.local.get('profile', (result) => {
    const profile = result.profile || {};
    
    // Update with parsed data
    profile.personal = parsedData.personal || profile.personal || {};
    profile.experience = parsedData.experience || profile.experience || [];
    profile.education = parsedData.education || profile.education || [];
    profile.skills = parsedData.skills || profile.skills || [];
    
    // Save to storage
    chrome.storage.local.set({ profile });
  });
}

// Create experience item
function createExperienceItem(exp: { company: string; title: string; startDate: string; endDate?: string; description: string; location?: string }, index: number) {
  const expItem = document.createElement('div');
  expItem.className = 'experience-item';
  expItem.dataset.index = String(index);
  
  expItem.innerHTML = `
    <button class="remove-btn" data-index="${index}">Remove</button>
    <div class="form-field">
      <label for="exp-company-${index}">Company</label>
      <input type="text" id="exp-company-${index}" value="${exp.company || ''}">
    </div>
    <div class="form-field">
      <label for="exp-title-${index}">Title</label>
      <input type="text" id="exp-title-${index}" value="${exp.title || ''}">
    </div>
    <div class="form-field">
      <label for="exp-start-${index}">Start Date</label>
      <input type="month" id="exp-start-${index}" value="${exp.startDate || ''}">
    </div>
    <div class="form-field">
      <label for="exp-end-${index}">End Date</label>
      <input type="month" id="exp-end-${index}" value="${exp.endDate || ''}">
    </div>
    <div class="form-field">
      <label for="exp-description-${index}">Description</label>
      <textarea id="exp-description-${index}" rows="3">${exp.description || ''}</textarea>
    </div>
    <div class="form-field">
      <label for="exp-location-${index}">Location</label>
      <input type="text" id="exp-location-${index}" value="${exp.location || ''}">
    </div>
  `;
  
  // Add event listener to remove button
  const removeBtn = expItem.querySelector('.remove-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      const btn = e.target as HTMLElement;
      const index = btn.dataset.index;
      if (index) {
        removeExperienceItem(parseInt(index));
      }
    });
  }
  
  return expItem;
}

// Create education item
function createEducationItem(edu: { institution: string; degree: string; field: string; startDate: string; endDate?: string; gpa?: string }, index: number) {
  const eduItem = document.createElement('div');
  eduItem.className = 'education-item';
  eduItem.dataset.index = String(index);
  
  eduItem.innerHTML = `
    <button class="remove-btn" data-index="${index}">Remove</button>
    <div class="form-field">
      <label for="edu-institution-${index}">Institution</label>
      <input type="text" id="edu-institution-${index}" value="${edu.institution || ''}">
    </div>
    <div class="form-field">
      <label for="edu-degree-${index}">Degree</label>
      <input type="text" id="edu-degree-${index}" value="${edu.degree || ''}">
    </div>
    <div class="form-field">
      <label for="edu-field-${index}">Field of Study</label>
      <input type="text" id="edu-field-${index}" value="${edu.field || ''}">
    </div>
    <div class="form-field">
      <label for="edu-start-${index}">Start Date</label>
      <input type="month" id="edu-start-${index}" value="${edu.startDate || ''}">
    </div>
    <div class="form-field">
      <label for="edu-end-${index}">End Date</label>
      <input type="month" id="edu-end-${index}" value="${edu.endDate || ''}">
    </div>
    <div class="form-field">
      <label for="edu-gpa-${index}">GPA</label>
      <input type="text" id="edu-gpa-${index}" value="${edu.gpa || ''}">
    </div>
  `;
  
  // Add event listener to remove button
  const removeBtn = eduItem.querySelector('.remove-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      const btn = e.target as HTMLElement;
      const index = btn.dataset.index;
      if (index) {
        removeEducationItem(parseInt(index));
      }
    });
  }
  
  return eduItem;
}

// Remove experience item
function removeExperienceItem(index: number) {
  chrome.storage.local.get('profile', (result) => {
    const profile = result.profile || {};
    
    if (profile.experience && profile.experience[index]) {
      profile.experience.splice(index, 1);
      
      // Save to storage
      chrome.storage.local.set({ profile }, () => {
        // Reload experience items
        loadExperienceItems();
      });
    }
  });
}

// Remove education item
function removeEducationItem(index: number) {
  chrome.storage.local.get('profile', (result) => {
    const profile = result.profile || {};
    
    if (profile.education && profile.education[index]) {
      profile.education.splice(index, 1);
      
      // Save to storage
      chrome.storage.local.set({ profile }, () => {
        // Reload education items
        loadEducationItems();
      });
    }
  });
}

// Add new experience item
const addExperienceBtn = document.getElementById('add-experience');
if (addExperienceBtn) {
  addExperienceBtn.addEventListener('click', () => {
    chrome.storage.local.get('profile', (result) => {
      const profile = result.profile || {};
      profile.experience = profile.experience || [];
      
      // Add empty experience item
      profile.experience.push({
        company: '',
        title: '',
        startDate: '',
        endDate: '',
        description: '',
        location: ''
      });
      
      // Save to storage
      chrome.storage.local.set({ profile }, () => {
        // Reload experience items
        loadExperienceItems();
      });
    });
  });
}

// Add new education item
const addEducationBtn = document.getElementById('add-education');
if (addEducationBtn) {
  addEducationBtn.addEventListener('click', () => {
    chrome.storage.local.get('profile', (result) => {
      const profile = result.profile || {};
      profile.education = profile.education || [];
      
      // Add empty education item
      profile.education.push({
        institution: '',
        degree: '',
        field: '',
        startDate: '',
        endDate: '',
        gpa: ''
      });
      
      // Save to storage
      chrome.storage.local.set({ profile }, () => {
        // Reload education items
        loadEducationItems();
      });
    });
  });
}

// Load experience items
function loadExperienceItems() {
  chrome.storage.local.get('profile', (result) => {
    if (result.profile && result.profile.experience) {
      const experienceContainer = document.getElementById('experience-container');
      if (experienceContainer) {
        experienceContainer.innerHTML = '';
        
        result.profile.experience.forEach((exp: any, index: number) => {
          const expItem = createExperienceItem(exp, index);
          experienceContainer.appendChild(expItem);
        });
      }
    }
  });
}

// Load education items
function loadEducationItems() {
  chrome.storage.local.get('profile', (result) => {
    if (result.profile && result.profile.education) {
      const educationContainer = document.getElementById('education-container');
      if (educationContainer) {
        educationContainer.innerHTML = '';
        
        result.profile.education.forEach((edu: any, index: number) => {
          const eduItem = createEducationItem(edu, index);
          educationContainer.appendChild(eduItem);
        });
      }
    }
  });
}

// Load profile data
function loadProfile() {
  chrome.storage.local.get('profile', (result) => {
    if (result.profile) {
      const profile = result.profile;
      
      // Fill personal info fields
      if (profile.personal) {
        const firstNameEl = document.getElementById('firstName') as HTMLInputElement;
        const lastNameEl = document.getElementById('lastName') as HTMLInputElement;
        const emailEl = document.getElementById('email') as HTMLInputElement;
        const phoneEl = document.getElementById('phone') as HTMLInputElement;
        
        if (firstNameEl) firstNameEl.value = profile.personal.firstName || '';
        if (lastNameEl) lastNameEl.value = profile.personal.lastName || '';
        if (emailEl) emailEl.value = profile.personal.email || '';
        if (phoneEl) phoneEl.value = profile.personal.phone || '';
        
        if (profile.personal.location) {
          const streetEl = document.getElementById('street') as HTMLInputElement;
          const cityEl = document.getElementById('city') as HTMLInputElement;
          const stateEl = document.getElementById('state') as HTMLInputElement;
          const postalCodeEl = document.getElementById('postalCode') as HTMLInputElement;
          const countryEl = document.getElementById('country') as HTMLInputElement;
          
          if (streetEl) streetEl.value = profile.personal.location.street || '';
          if (cityEl) cityEl.value = profile.personal.location.city || '';
          if (stateEl) stateEl.value = profile.personal.location.state || '';
          if (postalCodeEl) postalCodeEl.value = profile.personal.location.postalCode || '';
          if (countryEl) countryEl.value = profile.personal.location.country || '';
        }
      }
      
      // Load experience and education items
      loadExperienceItems();
      loadEducationItems();
      
      // Set auto-fill setting
      if (profile.settings && profile.settings.autoFill) {
        const autoFillEl = document.getElementById('auto-fill') as HTMLSelectElement;
        if (autoFillEl) autoFillEl.value = profile.settings.autoFill;
      }
    }
  });
}

// Save profile data
const saveButtons = document.querySelectorAll('.save-btn');
saveButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    chrome.storage.local.get('profile', (result) => {
      const profile = result.profile || {};
      
      // Get the parent tab content
      const tabContent = btn.closest('.tab-content');
      if (!tabContent) return;
      
      const tabId = tabContent.id;
      
      if (tabId === 'profile-tab') {
        // Update personal info
        profile.personal = profile.personal || {};
        
        const firstNameEl = document.getElementById('firstName') as HTMLInputElement;
        const lastNameEl = document.getElementById('lastName') as HTMLInputElement;
        const emailEl = document.getElementById('email') as HTMLInputElement;
        const phoneEl = document.getElementById('phone') as HTMLInputElement;
        
        if (firstNameEl) profile.personal.firstName = firstNameEl.value;
        if (lastNameEl) profile.personal.lastName = lastNameEl.value;
        if (emailEl) profile.personal.email = emailEl.value;
        if (phoneEl) profile.personal.phone = phoneEl.value;
        
        // Update location info
        profile.personal.location = profile.personal.location || {};
        
        const streetEl = document.getElementById('street') as HTMLInputElement;
        const cityEl = document.getElementById('city') as HTMLInputElement;
        const stateEl = document.getElementById('state') as HTMLInputElement;
        const postalCodeEl = document.getElementById('postalCode') as HTMLInputElement;
        const countryEl = document.getElementById('country') as HTMLInputElement;
        
        if (streetEl) profile.personal.location.street = streetEl.value;
        if (cityEl) profile.personal.location.city = cityEl.value;
        if (stateEl) profile.personal.location.state = stateEl.value;
        if (postalCodeEl) profile.personal.location.postalCode = postalCodeEl.value;
        if (countryEl) profile.personal.location.country = countryEl.value;
      } else if (tabId === 'experience-tab') {
        // Update experience
        profile.experience = [];
        document.querySelectorAll('.experience-item').forEach((item, index) => {
          const companyEl = document.getElementById(`exp-company-${index}`) as HTMLInputElement;
          const titleEl = document.getElementById(`exp-title-${index}`) as HTMLInputElement;
          const startDateEl = document.getElementById(`exp-start-${index}`) as HTMLInputElement;
          const endDateEl = document.getElementById(`exp-end-${index}`) as HTMLInputElement;
          const descriptionEl = document.getElementById(`exp-description-${index}`) as HTMLTextAreaElement;
          const locationEl = document.getElementById(`exp-location-${index}`) as HTMLInputElement;
          
          profile.experience.push({
            company: companyEl ? companyEl.value : '',
            title: titleEl ? titleEl.value : '',
            startDate: startDateEl ? startDateEl.value : '',
            endDate: endDateEl ? endDateEl.value : '',
            description: descriptionEl ? descriptionEl.value : '',
            location: locationEl ? locationEl.value : ''
          });
        });
      } else if (tabId === 'education-tab') {
        // Update education
        profile.education = [];
        document.querySelectorAll('.education-item').forEach((item, index) => {
          const institutionEl = document.getElementById(`edu-institution-${index}`) as HTMLInputElement;
          const degreeEl = document.getElementById(`edu-degree-${index}`) as HTMLInputElement;
          const fieldEl = document.getElementById(`edu-field-${index}`) as HTMLInputElement;
          const startDateEl = document.getElementById(`edu-start-${index}`) as HTMLInputElement;
          const endDateEl = document.getElementById(`edu-end-${index}`) as HTMLInputElement;
          const gpaEl = document.getElementById(`edu-gpa-${index}`) as HTMLInputElement;
          
          profile.education.push({
            institution: institutionEl ? institutionEl.value : '',
            degree: degreeEl ? degreeEl.value : '',
            field: fieldEl ? fieldEl.value : '',
            startDate: startDateEl ? startDateEl.value : '',
            endDate: endDateEl ? endDateEl.value : '',
            gpa: gpaEl ? gpaEl.value : ''
          });
        });
      } else if (tabId === 'settings-tab') {
        // Update settings
        profile.settings = profile.settings || {};
        
        const autoFillEl = document.getElementById('auto-fill') as HTMLSelectElement;
        if (autoFillEl) profile.settings.autoFill = autoFillEl.value;
      }
      
      // Save to storage
      chrome.storage.local.set({ profile }, () => {
        alert('Saved successfully!');
      });
    });
  });
});

// Initialize
loadProfile(); 
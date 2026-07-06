import type { Dictionary } from "./dictionary";

export const en: Dictionary = {
    intro: {
        cta: "Reserve your appointment",
    },
    wizard: {
        title: (clinicName) => `Book an appointment at ${clinicName}`,
        noLocations: "No locations are configured yet. Please check back later.",
    },
    nav: {
        back: "Back",
        continue: "Continue",
        confirm: "Confirm booking",
        submitting: "Submitting…",
    },
    progress: {
        aria: "Booking progress",
        location: "Location",
        services: "Services",
        datetime: "Date & time",
        contact: "Details",
    },
    location: {
        heading: "Choose a location",
    },
    services: {
        heading: "Choose services",
        total: (duration) => `Total: ${duration}`,
        none: "No services are available at this location yet.",
        free: "Free",
    },
    datetime: {
        heading: "Pick a date and time",
        finding: "Finding available times",
        loadError: "Could not load times.",
        noSlots: "No available slots for this date.",
    },
    contact: {
        heading: "Your details",
        locationLabel: "Location: ",
        whenLabel: "When: ",
        servicesLabel: "Services: ",
        totalLabel: (price) => `Total: ${price}`,
        firstName: "First name",
        lastName: "Last name",
        email: "Email",
        phone: "Phone",
        notes: "Notes (optional)",
    },
    validation: {
        firstName: "Enter your first name.",
        lastName: "Enter your last name.",
        email: "Enter a valid email address.",
        phoneRequired: "Enter your phone number.",
        phoneInvalid: "Enter a valid phone number.",
    },
    submitting: {
        heading: "Confirming your reservation…",
        subtext: "This will only take a moment. Please don't close this window.",
    },
    success: {
        heading: "Thank you!",
        message:
            "We look forward to seeing you. You'll receive your appointment confirmation by email.",
        again: "Book another appointment",
    },
    cancel: {
        heading: "Cancel your reservation?",
        subtext: "Please confirm that you want to cancel the reservation below.",
        confirm: "Cancel reservation",
        confirming: "Cancelling…",
        keep: "Keep reservation",
        alreadyHeading: "Already cancelled",
        alreadyText: "This reservation was already cancelled.",
        doneHeading: "Reservation cancelled",
        doneText:
            "Your reservation has been cancelled and the calendar event removed. A confirmation email is on its way.",
        bookAnother: "Book another reservation",
    },
};

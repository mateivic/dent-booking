// Shape of a public booking-UI translation. Both language dictionaries must
// implement this exactly, so a missing/renamed key is a compile error.
// Interpolated strings are modelled as functions for type-safe arguments.
export interface Dictionary {
    intro: {
        cta: string;
    };
    wizard: {
        title: (clinicName: string) => string;
        noLocations: string;
    };
    nav: {
        back: string;
        continue: string;
        confirm: string;
        submitting: string;
    };
    progress: {
        aria: string;
        location: string;
        services: string;
        datetime: string;
        contact: string;
    };
    location: {
        heading: string;
    };
    services: {
        heading: string;
        total: (duration: string) => string;
        none: string;
        free: string;
    };
    datetime: {
        heading: string;
        finding: string;
        loadError: string;
        noSlots: string;
    };
    contact: {
        heading: string;
        locationLabel: string;
        whenLabel: string;
        servicesLabel: string;
        totalLabel: (price: string) => string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        notes: string;
    };
    // Keyed by the codes returned from validateContact().
    validation: {
        firstName: string;
        lastName: string;
        email: string;
        phoneRequired: string;
        phoneInvalid: string;
    };
    submitting: {
        heading: string;
        subtext: string;
    };
    success: {
        heading: string;
        message: string;
        again: string;
    };
    cancel: {
        heading: string;
        subtext: string;
        confirm: string;
        confirming: string;
        keep: string;
        alreadyHeading: string;
        alreadyText: string;
        doneHeading: string;
        doneText: string;
        bookAnother: string;
    };
}

export type ValidationCode = keyof Dictionary["validation"];

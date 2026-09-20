"""
Pakistan / Karachi localization helpers for SENTINEL's operational workforce.

These values are synthetic and are used only to make SENTINEL's live
corporate simulation feel geographically coherent.

IMPORTANT:
    The canonical benchmark does not use this module. Benchmark workforce
    generation remains unchanged and reproducible.
"""

from __future__ import annotations

import random


# ============================================================
# Synthetic Pakistani-style names
# ============================================================

MALE_FIRST_NAMES: tuple[str, ...] = (
    "Muhammad",
    "Ahmed",
    "Ali",
    "Hassan",
    "Hussain",
    "Hamza",
    "Bilal",
    "Usman",
    "Omar",
    "Saad",
    "Talha",
    "Zain",
    "Abdullah",
    "Daniyal",
    "Shahzaib",
    "Fahad",
    "Taha",
    "Ahsan",
    "Farhan",
    "Sameer",
    "Rayan",
    "Ibrahim",
    "Muneeb",
    "Arham",
    "Raza",
)

FEMALE_FIRST_NAMES: tuple[str, ...] = (
    "Ayesha",
    "Fatima",
    "Zainab",
    "Mariam",
    "Hira",
    "Areeba",
    "Mahnoor",
    "Iqra",
    "Amna",
    "Sara",
    "Sana",
    "Mehwish",
    "Laiba",
    "Hafsa",
    "Anum",
    "Eman",
    "Komal",
    "Maha",
    "Nimra",
    "Rabia",
    "Alina",
    "Sidra",
    "Kinza",
    "Sehrish",
    "Aiman",
)

SURNAMES: tuple[str, ...] = (
    "Khan",
    "Ahmed",
    "Ali",
    "Siddiqui",
    "Malik",
    "Sheikh",
    "Qureshi",
    "Raza",
    "Iqbal",
    "Hussain",
    "Shah",
    "Farooq",
    "Ansari",
    "Abbasi",
    "Mirza",
    "Hashmi",
    "Chaudhry",
    "Akhtar",
    "Rizvi",
    "Nawaz",
    "Memon",
    "Jafri",
    "Kazi",
    "Saeed",
    "Rehman",
)


# ============================================================
# Karachi context
# ============================================================

KARACHI_HOME_AREAS: tuple[str, ...] = (
    "Gulshan-e-Iqbal",
    "Gulistan-e-Johar",
    "North Nazimabad",
    "Nazimabad",
    "Federal B Area",
    "PECHS",
    "DHA Karachi",
    "Clifton",
    "Scheme 33",
    "Malir",
    "Shah Faisal Colony",
    "Korangi",
    "Bahadurabad",
    "Tariq Road",
    "Saddar",
)

OFFICE_LOCATIONS: tuple[str, ...] = (
    "Karachi HQ",
    "Karachi HQ",
    "Karachi HQ",
    "Karachi Operations Office",
    "Karachi Sales Office",
)


# ============================================================
# Organizational metadata
# ============================================================

DEPARTMENT_CODES: dict[str, str] = {
    "Engineering": "ENG",
    "Finance": "FIN",
    "Human Resources": "HR",
    "Sales": "SAL",
    "IT Operations": "ITO",
}

ACCESS_TIER_BY_DEPARTMENT: dict[str, tuple[str, ...]] = {
    "Engineering": (
        "standard",
        "standard",
        "technical",
        "technical",
    ),
    "Finance": (
        "sensitive-business",
        "sensitive-business",
        "standard",
    ),
    "Human Resources": (
        "sensitive-business",
        "standard",
        "standard",
    ),
    "Sales": (
        "standard",
        "standard",
        "customer-data",
    ),
    "IT Operations": (
        "technical",
        "technical",
        "privileged",
    ),
}

SENIORITY_LEVELS: tuple[str, ...] = (
    "junior",
    "mid",
    "mid",
    "mid",
    "senior",
    "senior",
)


# ============================================================
# Generators
# ============================================================

def generate_pakistani_name(
    rng: random.Random,
) -> str:
    """
    Generate a Pakistani-style synthetic full name.
    """

    first_name_pool = (
        MALE_FIRST_NAMES
        if rng.random() < 0.55
        else FEMALE_FIRST_NAMES
    )

    return (
        f"{rng.choice(first_name_pool)} "
        f"{rng.choice(SURNAMES)}"
    )


def generate_home_area(
    rng: random.Random,
) -> str:
    """
    Choose a synthetic Karachi residential area.
    """

    return rng.choice(
        KARACHI_HOME_AREAS
    )


def generate_office_location(
    *,
    rng: random.Random,
    department: str,
) -> str:
    """
    Choose an office context appropriate to the department.
    """

    if department == "Sales":
        return rng.choices(
            population=(
                "Karachi HQ",
                "Karachi Sales Office",
                "Karachi Operations Office",
            ),
            weights=(
                0.45,
                0.40,
                0.15,
            ),
            k=1,
        )[0]

    if department == "IT Operations":
        return rng.choices(
            population=(
                "Karachi HQ",
                "Karachi Operations Office",
            ),
            weights=(
                0.60,
                0.40,
            ),
            k=1,
        )[0]

    return rng.choices(
        population=(
            "Karachi HQ",
            "Karachi Operations Office",
        ),
        weights=(
            0.88,
            0.12,
        ),
        k=1,
    )[0]


def generate_employee_code(
    *,
    department: str,
    employee_number: int,
) -> str:
    """
    Generate a readable internal employee reference.
    """

    department_code = (
        DEPARTMENT_CODES.get(
            department,
            "EMP",
        )
    )

    return (
        f"KHI-{department_code}-"
        f"{employee_number:04d}"
    )


def generate_demo_phone(
    employee_number: int,
) -> str:
    """
    Generate a deliberately non-dialable Pakistani-style demo number.

    X placeholders ensure the value cannot accidentally represent a
    real person's usable phone number.
    """

    suffix = (
        employee_number
        % 10_000
    )

    return (
        f"+92-3XX-XXX-{suffix:04d}"
    )


def generate_access_tier(
    *,
    rng: random.Random,
    department: str,
) -> str:
    """
    Generate a broad access classification.
    """

    values = (
        ACCESS_TIER_BY_DEPARTMENT[
            department
        ]
    )

    return rng.choice(
        values
    )


def generate_seniority(
    *,
    rng: random.Random,
    job_role: str,
) -> str:
    """
    Generate seniority while respecting explicitly senior/manager roles.
    """

    lowered = (
        job_role.lower()
    )

    if (
        "manager" in lowered
        or "senior" in lowered
    ):
        return "senior"

    return rng.choice(
        SENIORITY_LEVELS
    )


def is_privileged_role(
    *,
    department: str,
    job_role: str,
    access_tier: str,
) -> bool:
    """
    Determine whether the profile should normally have privileged access.
    """

    if access_tier == "privileged":
        return True

    privileged_titles = (
        "system administrator",
        "network administrator",
        "infrastructure engineer",
        "devops engineer",
    )

    return (
        department
        in {
            "Engineering",
            "IT Operations",
        }
        and job_role.lower()
        in privileged_titles
    )


def generate_operational_ip(
    *,
    department: str,
    employee_number: int,
) -> str:
    """
    Generate a deterministic, collision-resistant private IPv4 address.

    Operational employees use a separate addressing layout from the
    canonical benchmark so the benchmark remains unchanged.

    Example:
        10.31.0.110
        10.35.1.27
    """

    department_octets = {
        "Engineering": 31,
        "Finance": 32,
        "Human Resources": 33,
        "Sales": 34,
        "IT Operations": 35,
    }

    second_octet = (
        department_octets[
            department
        ]
    )

    zero_based = (
        employee_number
        - 1
    )

    subnet_block = (
        zero_based
        // 240
    )

    host = (
        10
        + (
            zero_based
            % 240
        )
    )

    return (
        f"10.{second_octet}."
        f"{subnet_block}."
        f"{host}"
    )

let nextUserId = 1;

const usersById = new Map();
const usersByEmail = new Map();

const buildUser = ({ email, full_name }) => ({
  id: String(nextUserId++),
  email,
  full_name,
});

export const findOrCreateGoogleUser = async (email, name) => {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUserId = usersByEmail.get(normalizedEmail);

  if (existingUserId) {
    const existingUser = usersById.get(existingUserId);

    if (name && existingUser.full_name !== name) {
      existingUser.full_name = name;
    }

    return existingUser;
  }

  const user = buildUser({
    email: normalizedEmail,
    full_name: name?.trim() || normalizedEmail,
  });

  usersById.set(user.id, user);
  usersByEmail.set(normalizedEmail, user.id);

  return user;
};

export const getUserById = async (id) => {
  const user = usersById.get(String(id));

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

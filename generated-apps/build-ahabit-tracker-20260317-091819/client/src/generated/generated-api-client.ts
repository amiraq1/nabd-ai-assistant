export interface Habit {
  id: string;
  name: string;
  frequency: string;
  completedToday: boolean;
  createdAt: string;
}

export interface InsertHabit extends Omit<Habit, "id"> {}

export const habitsApi = {
  list: () => fetch("/api/habits").then((response) => response.json() as Promise<Habit[]>),
  create: (input: InsertHabit) => fetch("/api/habits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }).then((response) => response.json() as Promise<Habit>),
};
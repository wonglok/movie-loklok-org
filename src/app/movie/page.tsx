import { FolderGate } from "@/components/movie-app/FolderGate";
import { MovieApp } from "@/components/movie-app/MovieApp";

export default function Page() {
  return (
    <>
      <FolderGate>
        <MovieApp></MovieApp>
      </FolderGate>
    </>
  );
}
